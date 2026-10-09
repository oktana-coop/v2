import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentError,
  type ConvergentDocumentState,
  ConvergentDocumentUnavailableError,
  type RemotePresence,
  RepresentationTransformError,
  type ResolvedDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToStream,
} from '../../../../utils/effect';
import {
  DocumentNotOnCurrentRefError,
  NotFoundError,
  RepositoryError,
  SharedDocumentUnavailableError,
} from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore, type ShareId } from '../ports';
import { type LiveDocumentError } from './live-document';
import {
  openLiveDocument,
  type OpenLiveDocumentDeps,
} from './open-live-document';
import {
  contentOf,
  contributionsTo,
  markdownDocument,
  promiseWithResolvers,
  proseMirrorDocument,
  transformParagraphToText,
  typeAndContribute,
  typeLeavingPending,
  useFakeTimersInTest,
  versionOf,
} from './test-utils';

// Covers openLiveDocument together with what it composes: the live document,
// the switchable convergent document and the stored copy. Fakes and mocks
// stand in only for the convergent documents, the store and the conversion.

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;
const shareLink = 'automerge:the-share' as ShareId;

const createFakeConvergentDocument = async ({
  name,
  initialText,
}: {
  name: string;
  initialText: string;
}) => {
  // Versions carry which document minted them.
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(initialText),
      version: `${name}.0`,
    })
  );
  const errorChannel =
    await Effect.runPromise(createErrorChannel<ConvergentDocumentError>());
  let versions = 0;

  // A new state of the document, from a contribution or from a peer.
  const update = (text: string) => {
    versions += 1;
    const version = `${name}.${versions}`;

    return pipe(
      SubscriptionRef.set(content, { doc: markdownDocument(text), version }),
      Effect.as(version)
    );
  };

  const change = vi.fn<ConvergentDocument['change']>((text) => update(text));
  const close = vi.fn();

  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );

  const document: ConvergentDocument = {
    content,
    presence: { peers, publish: () => Effect.void },
    change,
    errors: Stream.fromPubSub(errorChannel),
    close: Effect.sync(close),
  };

  return {
    document,
    change,
    close,
    update,
    // Something going wrong with this document, with nobody waiting on it.
    report: (error: ConvergentDocumentError) =>
      Effect.runSync(PubSub.publish(errorChannel, error)),
  };
};

type FakeConvergentDocument = Awaited<
  ReturnType<typeof createFakeConvergentDocument>
>;

// The store holding the document's file, announcing changes as a store does:
// once when it starts listening, then for any change under the project.
const createFakeDisk = ({ text }: { text: string }) => {
  let onDisk = text;
  let announceChange: (() => void) | undefined;

  // Reads what the disk holds when the read runs.
  const findRichTextDocumentById = vi.fn<
    ProjectStore['findRichTextDocumentById']
  >(() =>
    Effect.sync((): ResolvedDocument => ({
      id: documentId,
      artifact: markdownDocument(onDisk),
    }))
  );

  const updateRichTextDocumentContent = vi.fn<
    ProjectStore['updateRichTextDocumentContent']
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
    findRichTextDocumentById,
    updateRichTextDocumentContent,
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
    // What the live document wrote to the disk, in order.
    diskWrites: () =>
      updateRichTextDocumentContent.mock.calls.map(([{ content }]) => content),
  };
};

const openDocument = async ({
  diskText = 'on disk',
  shareText = 'on the share',
  shareId,
  beforeOpening,
}: {
  diskText?: string;
  // What any share opened or attached to holds.
  shareText?: string;
  shareId?: ShareId;
  // Adjusts the mocks for what has to happen while the document opens. Adjust
  // them after opening for anything later: opening calls some of them itself.
  beforeOpening?: (mocks: {
    openSharedDocument: Mock<OpenLiveDocumentDeps['openSharedDocument']>;
    findRichTextDocumentById: Mock<ProjectStore['findRichTextDocumentById']>;
    updateRichTextDocumentContent: Mock<
      ProjectStore['updateRichTextDocumentContent']
    >;
    editDisk: (next: string) => void;
  }) => void;
} = {}) => {
  const { projectContentChangeEvents, ...disk } = createFakeDisk({
    text: diskText,
  });

  // Every convergent document the live document has used, in order.
  const documents: FakeConvergentDocument[] = [];

  const startOn = (text: string) =>
    Effect.promise(async () => {
      const fake = await createFakeConvergentDocument({
        name: `d${documents.length}`,
        initialText: text,
      });
      documents.push(fake);
      return fake.document;
    });

  const createPrivateDocument = vi.fn<
    OpenLiveDocumentDeps['createPrivateDocument']
  >((initialText) => startOn(initialText));

  const openSharedDocument = vi.fn<OpenLiveDocumentDeps['openSharedDocument']>(
    () => startOn(shareText)
  );

  const onShareUnavailable =
    vi.fn<OpenLiveDocumentDeps['onShareUnavailable']>();

  const transformToText = vi.fn(transformParagraphToText);

  beforeOpening?.({
    openSharedDocument,
    findRichTextDocumentById: disk.findRichTextDocumentById,
    updateRichTextDocumentContent: disk.updateRichTextDocumentContent,
    editDisk: disk.editDisk,
  });

  const opened = await Effect.runPromise(
    openLiveDocument({
      createPrivateDocument,
      openSharedDocument,
      onShareUnavailable,
      transformToText,
      findRichTextDocumentById: disk.findRichTextDocumentById,
      updateRichTextDocumentContent: disk.updateRichTextDocumentContent,
      projectContentChangeEvents,
    })({ projectId, documentId, shareId })
  );

  // What the document reported while nobody was waiting. Subscribing after it
  // opened still catches what went wrong while it was opening.
  const reportedErrors: LiveDocumentError[] = [];
  subscribeToStream(opened.errors, (error) => {
    reportedErrors.push(error);
  });

  // The store announces once it is listening, and the file is read again.
  // Settled here, so that every test starts from a quiet document.
  await vi.waitFor(() =>
    expect(disk.findRichTextDocumentById).toHaveBeenCalledTimes(2)
  );

  return {
    opened,
    reportedErrors,
    // The document the live document opened on.
    initialDocument: documents[0]!,
    documents,
    createPrivateDocument,
    openSharedDocument,
    onShareUnavailable,
    transformToText,
    ...disk,
  };
};

describe('openLiveDocument', () => {
  describe('opening', () => {
    it('opens on what the store holds and writes nothing', async () => {
      const { diskWrites } = await openDocument({ diskText: 'hello' });
      useFakeTimersInTest();

      await vi.runAllTimersAsync();
      expect(diskWrites()).toEqual([]);
    });

    it('opens at the share when it has one', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'what the file has',
        shareText: 'what the share has',
        shareId: shareLink,
      });

      expect(documents).toHaveLength(1);
      const content = await contentOf(opened);
      expect(content).toBe('what the share has');
    });

    it('opens privately, reporting it, when the share cannot be opened', async () => {
      const { opened, documents, onShareUnavailable } = await openDocument({
        diskText: 'what the file has',
        shareId: shareLink,
        beforeOpening: ({ openSharedDocument }) => {
          openSharedDocument.mockReturnValueOnce(
            Effect.fail(new SharedDocumentUnavailableError('out of reach'))
          );
        },
      });

      expect(onShareUnavailable).toHaveBeenCalledWith(
        expect.any(SharedDocumentUnavailableError)
      );
      // The unreachable share never became one of its documents.
      expect(documents).toHaveLength(1);
      const content = await contentOf(opened);
      expect(content).toBe('what the file has');
    });

    it('carries content the document opened with to the file', async () => {
      // Opening at a share starts the document on content the file does not have.
      const { diskWrites } = await openDocument({
        diskText: 'what the file has',
        shareText: 'what the share has',
        shareId: shareLink,
      });

      await vi.waitFor(() =>
        expect(diskWrites()).toContain('what the share has')
      );
    });

    it('keeps a failed write on opening until someone listens', async () => {
      const { opened } = await openDocument({
        diskText: 'what the file has',
        shareId: shareLink,
        beforeOpening: ({ updateRichTextDocumentContent }) => {
          updateRichTextDocumentContent.mockReturnValue(
            Effect.fail(new RepositoryError('the store refused the write'))
          );
        },
      });

      // Someone starts listening only once the document is open, after the
      // write made while opening has failed.
      const listener = vi.fn();
      subscribeToStream(opened.errors, listener);

      await vi.waitFor(() =>
        expect(listener).toHaveBeenCalledWith(expect.any(RepositoryError))
      );
    });
  });

  describe('typing', () => {
    it('holds a burst of typing and contributes its newest content once it pauses', async () => {
      const { opened, initialDocument, transformToText } = await openDocument({
        diskText: 'hello',
      });
      useFakeTimersInTest();

      const contributions = ['a', 'ab', 'abc'].map((text) =>
        typeLeavingPending({ opened, doc: proseMirrorDocument(text) })
      );
      // Lets everything run except the contribution debounce.
      await vi.advanceTimersByTimeAsync(0);
      expect(initialDocument.change).not.toHaveBeenCalled();

      // Lets the contribution debounce elapse.
      await vi.runAllTimersAsync();

      expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith('abc', {
        base: undefined,
      });
      expect(transformToText).toHaveBeenCalledTimes(1);
      // The whole burst resolves with the one version it was contributed as.
      const version = await versionOf(opened);
      await expect(Promise.all(contributions)).resolves.toEqual([
        version,
        version,
        version,
      ]);
    });

    it('contributes pending typing on flush', async () => {
      const { opened, diskWrites, transformToText } = await openDocument({
        diskText: 'hello',
      });

      const contribution = typeLeavingPending({
        opened,
        doc: proseMirrorDocument('hello typed'),
      });
      await Effect.runPromise(opened.flush);

      await expect(contribution).resolves.toBe(await versionOf(opened));
      expect(diskWrites()).toEqual(['hello typed']);
      expect(transformToText).toHaveBeenCalledTimes(1);
    });

    it('drops pending typing on dropPendingLocalEdits', async () => {
      const { opened, diskWrites, initialDocument } = await openDocument({
        diskText: 'hello',
      });
      const versionBefore = await versionOf(opened);

      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('restored old state'),
      });
      await Effect.runPromise(opened.dropPendingLocalEdits);
      await Effect.runPromise(opened.flush);

      // Whoever waited for it is released, with the version the document holds.
      await expect(contribution).resolves.toBe(versionBefore);
      expect(initialDocument.change).not.toHaveBeenCalled();
      expect(diskWrites()).toEqual([]);
    });

    it('raises to whoever waits for a flush when the typing cannot be converted, and writes nothing', async () => {
      const { opened, diskWrites, transformToText } = await openDocument({
        diskText: 'hello',
      });
      transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

      const contribution = typeLeavingPending({
        opened,
        doc: proseMirrorDocument('hello typed'),
      });
      const failure = await Effect.runPromise(Effect.flip(opened.flush));

      expect(failure).toBeInstanceOf(RepresentationTransformError);
      expect(diskWrites()).toEqual([]);

      // The typing is still on its way: the next flush writes it.
      await Effect.runPromise(opened.flush);

      await expect(contribution).resolves.toBe(await versionOf(opened));
      expect(diskWrites()).toEqual(['hello typed']);
    });
  });

  describe('writing to the file', () => {
    it('writes what the document holds', async () => {
      const { opened, diskWrites } = await openDocument({ diskText: 'hello' });

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });

      await vi.waitFor(() => expect(diskWrites()).toContain('hello world'));
    });

    it('writes states as they come, each once and the newest last', async () => {
      const { opened, diskWrites } = await openDocument({ diskText: 'hello' });

      for (const text of ['a', 'ab', 'abc']) {
        await typeAndContribute({ opened, doc: markdownDocument(text) });
      }
      await Effect.runPromise(opened.flush);

      const writes = diskWrites();
      expect(writes[writes.length - 1]).toBe('abc');
      expect(new Set(writes).size).toBe(writes.length);
    });

    it('flushes what the disk does not hold yet, and is idempotent', async () => {
      const { opened, diskWrites } = await openDocument({ diskText: 'hello' });

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });
      await Effect.runPromise(opened.flush);
      await Effect.runPromise(opened.flush);

      expect(diskWrites()).toEqual(['hello world']);
    });

    it('raises to whoever waits for a flush when the write fails', async () => {
      const { opened, updateRichTextDocumentContent } = await openDocument({
        diskText: 'hello',
      });
      updateRichTextDocumentContent.mockReturnValue(
        Effect.fail(new RepositoryError('the store refused the write'))
      );

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });

      const failure = await Effect.runPromise(Effect.flip(opened.flush));

      expect(failure).toBeInstanceOf(RepositoryError);
    });

    it('reports a write nobody awaited when it fails', async () => {
      const { opened, reportedErrors, updateRichTextDocumentContent } =
        await openDocument({
          diskText: 'hello',
        });
      updateRichTextDocumentContent.mockReturnValue(
        Effect.fail(new RepositoryError('the store refused the write'))
      );

      // Writes on the new state rather than awaiting a flush.
      await typeAndContribute({ opened, doc: markdownDocument('hello world') });

      await vi.waitFor(() =>
        expect(reportedErrors[0]).toBeInstanceOf(RepositoryError)
      );
    });
  });

  describe('following the file', () => {
    it('reads the file again once the store listens, and changes nothing', async () => {
      const { findRichTextDocumentById, initialDocument, diskWrites } =
        await openDocument({ diskText: 'hello' });

      expect(findRichTextDocumentById).toHaveBeenCalledTimes(2);
      expect(initialDocument.change).not.toHaveBeenCalled();
      expect(diskWrites()).toEqual([]);
    });

    it('picks up a change made before the store listened', async () => {
      const { opened } = await openDocument({
        diskText: 'hello',
        beforeOpening: ({ findRichTextDocumentById, editDisk }) => {
          // The edit arrives right after the file is read for opening, while
          // nobody is listening yet.
          findRichTextDocumentById.mockReturnValueOnce(
            Effect.sync((): ResolvedDocument => {
              editDisk('changed before listening');
              return { id: documentId, artifact: markdownDocument('hello') };
            })
          );
        },
      });

      const content = await contentOf(opened);
      expect(content).toContain('changed before listening');
    });

    it('picks up a change made outside the app', async () => {
      const { opened, editDisk } = await openDocument({ diskText: 'hello' });

      editDisk('changed outside');

      await vi.waitFor(async () => {
        const content = await contentOf(opened);
        expect(content).toContain('changed outside');
      });
    });

    it('ignores the echo of its own write', async () => {
      const { opened, editDisk, initialDocument } = await openDocument({
        diskText: 'hello',
      });
      useFakeTimersInTest();

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });
      await Effect.runPromise(opened.flush);
      initialDocument.change.mockClear();

      // The store announces the write this document just made.
      editDisk('hello world');
      await vi.runAllTimersAsync();

      expect(initialDocument.change).not.toHaveBeenCalled();
    });

    it('keeps typing that arrives while its own write echoes back', async () => {
      const { opened, editDisk } = await openDocument({ diskText: 'hello' });
      useFakeTimersInTest();

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });
      await Effect.runPromise(opened.flush);
      // Typed after the write, before the store announced it: still on its
      // way to the document when the echo arrives.
      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('hello world!'),
      });

      editDisk('hello world');
      await vi.runAllTimersAsync();
      await Effect.runPromise(opened.applyPendingLocalEdits);

      await expect(contribution).resolves.toBe(await versionOf(opened));
      const content = await contentOf(opened);
      expect(content).toBe('hello world!');
    });

    it('anchors an outside change at the version the file derives from', async () => {
      const { opened, editDisk, initialDocument } = await openDocument({
        diskText: 'hello',
      });

      await typeAndContribute({ opened, doc: markdownDocument('hello typed') });
      await Effect.runPromise(opened.flush);
      const versionOnDisk = await versionOf(opened);

      editDisk('hello from elsewhere');

      await vi.waitFor(() =>
        expect(initialDocument.change).toHaveBeenLastCalledWith(
          'hello from elsewhere',
          { base: versionOnDisk }
        )
      );
    });

    // The disk and the editor both derive from the version last written,
    // without either extending the other.
    it('keeps pending typing and an outside change that share the version on disk', async () => {
      const { opened, editDisk, initialDocument, diskHolds } =
        await openDocument({
          diskText: 'hello',
        });
      const versionOnDisk = await versionOf(opened);

      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('hello LOCAL'),
        base: versionOnDisk,
      });
      editDisk('hello DISK');
      await vi.waitFor(() =>
        expect(initialDocument.change).toHaveBeenCalledWith('hello DISK', {
          base: versionOnDisk,
        })
      );
      // The document merges the typing with the change it had not seen.
      initialDocument.change.mockImplementationOnce(() =>
        initialDocument.update('hello DISK and LOCAL')
      );
      await Effect.runPromise(opened.flush);

      await expect(contribution).resolves.toBe(await versionOf(opened));
      expect(contributionsTo(initialDocument)).toEqual([
        { text: 'hello DISK', base: versionOnDisk },
        { text: 'hello LOCAL', base: versionOnDisk },
      ]);
      expect(diskHolds()).toBe('hello DISK and LOCAL');
    });

    it('keeps working, silently, when the document is gone', async () => {
      const {
        opened,
        findRichTextDocumentById,
        announceChange,
        reportedErrors,
        initialDocument,
      } = await openDocument({
        diskText: 'hello',
      });
      useFakeTimersInTest();

      await typeAndContribute({ opened, doc: markdownDocument('hello typed') });
      initialDocument.change.mockClear();
      findRichTextDocumentById.mockReturnValue(
        Effect.fail(new NotFoundError('the document is gone'))
      );
      announceChange();
      await vi.runAllTimersAsync();

      expect(initialDocument.change).not.toHaveBeenCalled();
      expect(reportedErrors).toEqual([]);
    });

    it('contributes nothing to the share, silently, while the project is on another branch', async () => {
      const {
        findRichTextDocumentById,
        announceChange,
        reportedErrors,
        documents,
      } = await openDocument({
        diskText: 'hello',
        shareText: 'hello',
        shareId: shareLink,
      });
      useFakeTimersInTest();
      const [share] = documents;

      findRichTextDocumentById.mockReturnValue(
        Effect.fail(
          new DocumentNotOnCurrentRefError('the project is on another branch', {
            currentBranch: 'draft' as Branch,
          })
        )
      );
      announceChange();
      await vi.runAllTimersAsync();

      expect(share.change).not.toHaveBeenCalled();
      expect(reportedErrors).toEqual([]);
    });

    it('reports a re-read of the file that fails', async () => {
      const { findRichTextDocumentById, announceChange, reportedErrors } =
        await openDocument({
          diskText: 'hello',
        });
      findRichTextDocumentById.mockReturnValueOnce(
        Effect.fail(new RepositoryError('the store could not be read'))
      );

      announceChange();

      await vi.waitFor(() =>
        expect(reportedErrors[0]).toBeInstanceOf(RepositoryError)
      );
    });
  });

  describe('attaching and detaching', () => {
    it('switches to the shared document on attaching, and closes the old one', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
        shareText: 'what the share has',
      });

      await Effect.runPromise(opened.attachTo(shareLink));

      expect(documents).toHaveLength(2);
      expect(documents[0]!.close).toHaveBeenCalledOnce();
      const content = await contentOf(opened);
      expect(content).toBe('what the share has');
    });

    it('contributes to the document it switched to, not the one it left', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
      });
      await Effect.runPromise(opened.attachTo(shareLink));
      documents[0]!.change.mockClear();

      await typeAndContribute({
        opened,
        doc: markdownDocument('typed while shared'),
      });

      expect(documents[0]!.change).not.toHaveBeenCalled();
      expect(documents[1]!.change).toHaveBeenLastCalledWith(
        'typed while shared',
        {
          base: undefined,
        }
      );
    });

    it('follows the document it switched to', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
      });
      await Effect.runPromise(opened.attachTo(shareLink));

      // A peer's change, published by the shared document it switched to.
      await Effect.runPromise(documents[1]!.update('what a peer typed'));

      await vi.waitFor(async () => {
        const content = await contentOf(opened);
        expect(content).toBe('what a peer typed');
      });
    });

    it('carries what the shared document holds to the file', async () => {
      const { opened, diskWrites } = await openDocument({
        diskText: 'what the file has',
        shareText: 'what the share has',
      });

      await Effect.runPromise(opened.attachTo(shareLink));

      await vi.waitFor(() =>
        expect(diskWrites()).toContain('what the share has')
      );
    });

    it('contributes pending typing to the document it leaves before switching', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
      });

      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('typed before sharing'),
      });
      await Effect.runPromise(opened.attachTo(shareLink));

      await expect(contribution).resolves.toBe(
        await versionOf(documents[0]!.document)
      );
      expect(documents[0]!.change).toHaveBeenLastCalledWith(
        'typed before sharing',
        { base: undefined }
      );
      expect(documents[1]!.change).not.toHaveBeenCalled();
    });

    it('keeps pending typing when detaching', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
      });
      await Effect.runPromise(opened.attachTo(shareLink));

      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('typed while shared'),
      });
      await Effect.runPromise(opened.detach);

      await expect(contribution).resolves.toBe(
        await versionOf(documents[1]!.document)
      );
      const content = await contentOf(opened);
      expect(content).toBe('typed while shared');
    });

    it('switches to a private document on detaching, keeping the content', async () => {
      const { opened, documents } = await openDocument({
        diskText: 'on its own',
        shareText: 'what the share has',
      });
      await Effect.runPromise(opened.attachTo(shareLink));

      await Effect.runPromise(opened.detach);

      expect(documents).toHaveLength(3);
      expect(documents[1]!.close).toHaveBeenCalledOnce();
      // Its own document again, holding what the share left it with.
      const content = await contentOf(opened);
      expect(content).toBe('what the share has');
    });

    it('anchors a later disk change in the document it switched to', async () => {
      const { opened, documents, editDisk } = await openDocument({
        diskText: 'what the file has',
      });
      await Effect.runPromise(opened.attachTo(shareLink));
      const versionAfterSwitch = await versionOf(opened);

      editDisk('changed outside');

      // A base from the document it left would be dropped by the new one.
      await vi.waitFor(() =>
        expect(documents[1]!.change).toHaveBeenLastCalledWith(
          'changed outside',
          {
            base: versionAfterSwitch,
          }
        )
      );
    });
  });

  describe('reporting', () => {
    it('passes on what the convergent document reports', async () => {
      const { reportedErrors, documents } = await openDocument({
        diskText: 'hello',
      });

      // Relies on the error channel's replay: the subscription to reported
      // errors may not be active yet when this is reported.
      documents[0]!.report(
        new ConvergentDocumentUnavailableError('the document was deleted')
      );

      await vi.waitFor(() =>
        expect(reportedErrors[0]).toBeInstanceOf(
          ConvergentDocumentUnavailableError
        )
      );
    });

    it('passes on what the document it switched to reports', async () => {
      const { opened, documents, reportedErrors } = await openDocument({
        diskText: 'on its own',
      });
      await Effect.runPromise(opened.attachTo(shareLink));

      documents[1]!.report(
        new ConvergentDocumentUnavailableError('the share went away')
      );

      await vi.waitFor(() =>
        expect(reportedErrors).toContainEqual(
          expect.any(ConvergentDocumentUnavailableError)
        )
      );
    });

    it('stops passing on what the document it left reports', async () => {
      const { opened, documents, reportedErrors } = await openDocument({
        diskText: 'on its own',
      });
      useFakeTimersInTest();
      await Effect.runPromise(opened.attachTo(shareLink));

      documents[0]!.report(
        new ConvergentDocumentUnavailableError('from the document it left')
      );
      await vi.runAllTimersAsync();

      expect(reportedErrors).toEqual([]);
    });
  });

  describe('closing', () => {
    // Typing that has not reached the convergent document yet.
    it('contributes pending typing when it closes', async () => {
      const { opened, diskWrites } = await openDocument({ diskText: 'hello' });

      const contribution = typeLeavingPending({
        opened,
        doc: markdownDocument('hello world'),
      });
      await Effect.runPromise(opened.close);

      await expect(contribution).resolves.toBe(await versionOf(opened));
      expect(diskWrites()).toContain('hello world');
    });

    // A state the convergent document already holds, but that has not been
    // written to the file yet.
    it('writes what the file does not hold yet when it closes', async () => {
      const { opened, diskWrites } = await openDocument({ diskText: 'hello' });

      await typeAndContribute({ opened, doc: markdownDocument('hello world') });
      await Effect.runPromise(opened.close);

      expect(diskWrites()).toContain('hello world');
    });

    it('closes and raises when the typing cannot be converted at close, writing nothing', async () => {
      const { opened, diskWrites, initialDocument, transformToText } =
        await openDocument({
          diskText: 'hello',
        });
      transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

      typeLeavingPending({
        opened,
        doc: proseMirrorDocument('hello typed'),
      });
      const failure = await Effect.runPromise(Effect.flip(opened.close));

      expect(failure).toBeInstanceOf(RepresentationTransformError);
      expect(initialDocument.close).toHaveBeenCalledOnce();
      expect(diskWrites()).toEqual([]);
    });

    it('finishes a re-read of the file that is under way when it closes', async () => {
      const { opened, findRichTextDocumentById, announceChange, diskWrites } =
        await openDocument({ diskText: 'hello' });
      const read = promiseWithResolvers<ResolvedDocument>();
      findRichTextDocumentById.mockReturnValueOnce(
        Effect.promise(() => read.promise)
      );

      announceChange();
      await vi.waitFor(() =>
        expect(findRichTextDocumentById).toHaveBeenCalledTimes(3)
      );
      const closing = Effect.runPromise(opened.close);
      read.resolve({
        id: documentId,
        artifact: markdownDocument('changed outside'),
      });
      await closing;

      const content = await contentOf(opened);
      expect(content).toContain('changed outside');
      // What the disk holds was taken in whole, so closing has nothing to write.
      expect(diskWrites()).toEqual([]);
    });

    it('stops following the file once closed', async () => {
      const { opened, editDisk, initialDocument } = await openDocument({
        diskText: 'hello',
      });
      useFakeTimersInTest();

      await Effect.runPromise(opened.close);
      initialDocument.change.mockClear();

      editDisk('after closing');
      await vi.runAllTimersAsync();

      expect(initialDocument.change).not.toHaveBeenCalled();
    });
  });
});
