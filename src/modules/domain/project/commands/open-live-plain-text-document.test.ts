import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  type PlainTextConvergentDocument,
  type PlainTextConvergentDocumentState,
  plainTextDocument,
  type PlainTextParticipantSelection,
} from '../../../../modules/domain/plain-text';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { type RemotePresence, type ShareId } from '../../collaboration';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import {
  openLivePlainTextDocument,
  type OpenLivePlainTextDocumentDeps,
} from './open-live-plain-text-document';

// Covers what opening a plain-text document adds to the generic live
// document: plain text in the document, and the file's own line
// endings and byte order mark kept on disk. A fake stands in for the
// convergent document and the store.

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/config.yaml' as ArtifactId;
const shareLink = 'automerge:the-share' as ShareId;

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const createFakeConvergentDocument = async (text: string) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<PlainTextConvergentDocumentState>({
      doc: plainTextDocument(text),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<
      ReadonlyArray<RemotePresence<PlainTextParticipantSelection>>
    >([])
  );
  let versions = 0;

  const change = vi.fn<PlainTextConvergentDocument['change']>((doc) => {
    versions += 1;
    const version = `v${versions}`;

    return pipe(
      SubscriptionRef.set(content, { doc, version }),
      Effect.as(version)
    );
  });

  const document: PlainTextConvergentDocument = {
    content,
    presence: { peers, publish: () => Effect.void },
    change,
    errors: Stream.empty,
    close: Effect.void,
  };

  return { document, change };
};

// The store holding the file, announcing changes as a store does: once when
// it starts listening, then for any change under the project.
const createFakeDisk = ({ content }: { content: string }) => {
  let onDisk = content;
  let announceChange: (() => void) | undefined;

  const findPlainTextDocumentById = vi.fn<
    ProjectStore['findPlainTextDocumentById']
  >(() => Effect.sync(() => ({ content: onDisk })));

  const updatePlainTextDocumentContent = vi.fn<
    ProjectStore['updatePlainTextDocumentContent']
  >(({ content }) =>
    Effect.sync(() => {
      onDisk = content;
    })
  );

  const projectContentChangeEvents = vi.fn<
    ProjectStore['projectContentChangeEvents']
  >(() =>
    Stream.async<void>((emit) => {
      announceChange = () => {
        emit.single(undefined);
      };
      emit.single(undefined);

      return Effect.sync(() => {
        announceChange = undefined;
      });
    })
  );

  return {
    findPlainTextDocumentById,
    updatePlainTextDocumentContent,
    projectContentChangeEvents,
    // An edit made by another hand, announced like the store would.
    editDisk: (next: string) => {
      onDisk = next;
      announceChange?.();
    },
    // The store announcing a change under the project, as it does for any.
    announceChange: () => {
      announceChange?.();
    },
    diskHolds: () => onDisk,
    diskWrites: () =>
      updatePlainTextDocumentContent.mock.calls.map(([{ content }]) => content),
  };
};

const openDocument = async ({
  diskContent,
  shareText = 'on the share\n',
  shareId,
}: {
  diskContent: string;
  shareText?: string;
  shareId?: ShareId;
}) => {
  const disk = createFakeDisk({ content: diskContent });
  const documents: Awaited<ReturnType<typeof createFakeConvergentDocument>>[] =
    [];

  const startOn = (text: string) =>
    Effect.promise(async () => {
      const fake = await createFakeConvergentDocument(text);
      documents.push(fake);
      return fake.document;
    });

  const opened = await Effect.runPromise(
    openLivePlainTextDocument({
      createPrivateDocument: (doc) => startOn(doc.content),
      openSharedDocument: () => startOn(shareText),
      onShareUnavailable:
        vi.fn<OpenLivePlainTextDocumentDeps['onShareUnavailable']>(),
      findPlainTextDocumentById: disk.findPlainTextDocumentById,
      updatePlainTextDocumentContent: disk.updatePlainTextDocumentContent,
      projectContentChangeEvents: disk.projectContentChangeEvents,
    })({ projectId, documentId, shareId })
  );

  // The store announces once it is listening, and the file is read again.
  // Settled here, so that every test starts from a quiet document.
  await vi.waitFor(() =>
    expect(disk.findPlainTextDocumentById).toHaveBeenCalledTimes(2)
  );

  return { opened, initialDocument: documents[0]!, ...disk };
};

const textOf = (opened: Pick<PlainTextConvergentDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(opened.content)).then(
    (state) => state.doc.content
  );

describe('openLivePlainTextDocument', () => {
  it('opens on the file text with LF line endings and no byte order mark', async () => {
    const { opened, diskWrites } = await openDocument({
      diskContent: `${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n`,
    });

    expect(await textOf(opened)).toBe('a: 1\nb: 2\n');
    expect(diskWrites()).toEqual([]);
  });

  it('does not rewrite a file with mixed line endings on opening', async () => {
    const { diskWrites } = await openDocument({
      diskContent: 'a: 1\r\nb: 2\r\nc: 3\n',
    });

    expect(diskWrites()).toEqual([]);
  });

  it('writes an edit with the file line endings and byte order mark', async () => {
    const { opened, diskHolds } = await openDocument({
      diskContent: `${BYTE_ORDER_MARK}a: 1\r\n`,
    });

    await Effect.runPromise(opened.edit(plainTextDocument('a: 1\nb: 2\n')));

    await vi.waitFor(() =>
      expect(diskHolds()).toBe(`${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n`)
    );
  });

  it('takes its own write coming back as an echo, not an outside edit', async () => {
    const {
      opened,
      initialDocument,
      diskWrites,
      announceChange,
      findPlainTextDocumentById,
    } = await openDocument({ diskContent: 'a: 1\r\n' });
    await Effect.runPromise(opened.edit(plainTextDocument('a: 2\n')));
    await vi.waitFor(() => expect(diskWrites()).toEqual(['a: 2\r\n']));

    announceChange();
    await vi.waitFor(() =>
      expect(findPlainTextDocumentById).toHaveBeenCalledTimes(3)
    );
    // Waits for the refresh to finish, which holds the same lock.
    await Effect.runPromise(opened.flush);

    // Only the edit reached the document.
    expect(initialDocument.change).toHaveBeenCalledOnce();
  });

  it('takes in an outside edit with LF line endings', async () => {
    const { opened, editDisk } = await openDocument({
      diskContent: 'a: 1\r\n',
    });

    editDisk('a: 1\r\nb: 2\r\n');

    await vi.waitFor(async () =>
      expect(await textOf(opened)).toBe('a: 1\nb: 2\n')
    );
  });

  it('writes with the line endings the file was last read with', async () => {
    const {
      opened,
      initialDocument,
      editDisk,
      diskWrites,
      findPlainTextDocumentById,
    } = await openDocument({ diskContent: 'a: 1\r\n' });
    editDisk('a: 1\n');
    await vi.waitFor(() =>
      expect(findPlainTextDocumentById).toHaveBeenCalledTimes(3)
    );

    await Effect.runPromise(opened.edit(plainTextDocument('a: 2\n')));

    await vi.waitFor(() => expect(diskWrites()).toEqual(['a: 2\n']));
    // The text did not change, only how the file stores it.
    expect(initialDocument.change).toHaveBeenCalledOnce();
  });

  it('writes the text of the share it opened at with the file format', async () => {
    const { diskWrites } = await openDocument({
      diskContent: 'a: 1\r\n',
      shareText: 'a: 1\nfrom: the share\n',
      shareId: shareLink,
    });

    await vi.waitFor(() =>
      expect(diskWrites()).toEqual(['a: 1\r\nfrom: the share\r\n'])
    );
  });
});
