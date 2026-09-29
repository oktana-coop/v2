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
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToStream,
} from '../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  SharedDocumentUnavailableError,
} from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore, type ShareId } from '../ports';
import { type LiveDocumentError } from './live-document';
import { openLiveDocument } from './open-live-document';
import {
  contentOf,
  contributionsTo,
  markdownDocument,
  proseMirrorDocument,
  transformParagraphToText,
  typeAndContribute,
  typeLeavingPending,
  versionOf,
} from './test-utils';

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;

// A convergent document holding text, versioned by a counter. Contributions
// anchored at an older version merge rather than replace, as the real one
// does; that is what the disk relies on.
const createFakeConvergentDocument = async ({
  name,
  initialText,
}: {
  name: string;
  initialText: string;
}) => {
  // Versions carry which document minted them, as heads do: no version of one
  // document is ever a version of another.
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
  const publish = (text: string) => {
    versions += 1;
    const version = `${name}.${versions}`;

    return pipe(
      SubscriptionRef.set(content, { doc: markdownDocument(text), version }),
      Effect.as(version)
    );
  };

  const change: Mock<ConvergentDocument['change']> = vi.fn((text, options) =>
    pipe(
      SubscriptionRef.get(content),
      Effect.flatMap((current) => {
        // An anchored contribution keeps what it had not seen.
        const merged =
          options?.base !== undefined && options.base !== current.version
            ? `${current.doc.content} + ${text}`
            : text;

        return publish(merged);
      })
    )
  );
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
    publish,
    // Something going wrong with this document, with nobody waiting on it.
    report: (error: ConvergentDocumentError) =>
      Effect.runSync(PubSub.publish(errorChannel, error)),
  };
};

type FakeConvergentDocument = Awaited<
  ReturnType<typeof createFakeConvergentDocument>
>;

const openDocument = async ({
  diskText = 'on disk',
  liveText = diskText,
  shareId,
  sharedText = 'what the share has',
  shareIsOutOfReach = false,
  storeRefusesWrites = false,
}: {
  diskText?: string;
  liveText?: string;
  shareId?: ShareId;
  sharedText?: string;
  shareIsOutOfReach?: boolean;
  storeRefusesWrites?: boolean;
} = {}) => {
  let onDisk = diskText;
  const written: string[] = [];
  const onShareUnavailable = vi.fn();
  let watcher: (() => void) | undefined;

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

  // A private document starts from the text it is given, except the first,
  // seeded with `liveText` so a document can open holding something the disk
  // has never seen.
  const createPrivateDocument = (initialText: string) =>
    startOn(documents.length === 0 ? liveText : initialText);

  // What the share holds, which is not what the disk holds.
  const openSharedDocument = () =>
    shareIsOutOfReach
      ? Effect.fail(new SharedDocumentUnavailableError('out of reach'))
      : startOn(sharedText);

  // Reads what the disk holds when the read runs.
  const findDocumentById = vi.fn<ProjectStore['findDocumentById']>(() =>
    Effect.sync((): ResolvedDocument => ({
      id: documentId,
      artifact: markdownDocument(onDisk),
    }))
  );

  const transformToText = vi.fn(transformParagraphToText);

  const opened = await Effect.runPromise(
    openLiveDocument({
      createPrivateDocument,
      openSharedDocument,
      onShareUnavailable,
      transformToText,
      findDocumentById,
      updateRichTextDocumentContent: ({ content }) =>
        Effect.suspend(() =>
          storeRefusesWrites
            ? Effect.fail(new RepositoryError('the store refused the write'))
            : Effect.sync(() => {
                written.push(content);
                onDisk = content;
              })
        ),
      subscribeToProjectDirChanges: (listener) => {
        watcher = listener;
        return () => {
          watcher = undefined;
        };
      },
    })({ projectId, documentId, shareId })
  );

  // What the document reported while nobody was waiting. Subscribing after it
  // opened still catches what went wrong while it was opening.
  const reportedErrors: LiveDocumentError[] = [];
  subscribeToStream(opened.errors, (error) => {
    reportedErrors.push(error);
  });

  return {
    opened,
    written,
    documents,
    reportedErrors,
    transformToText,
    findDocumentById,
    // The document the live document opened on.
    initialDocument: documents[0]!,
    onShareUnavailable,
    // An edit made by another hand, reported like the watcher would.
    editDisk: (text: string) => {
      onDisk = text;
      watcher?.();
    },
    // The watcher reporting a change under the project, as it does for any.
    notifyWatcher: () => {
      watcher?.();
    },
    diskHolds: () => onDisk,
  };
};

describe('openLiveDocument', () => {
  it('opens on what the store holds and writes nothing', async () => {
    const { written } = await openDocument({ diskText: 'hello' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(written).toEqual([]);
  });

  it('writes what the document holds', async () => {
    const { opened, written } = await openDocument({ diskText: 'hello' });

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });

    await vi.waitFor(() => expect(written).toContain('hello world'));
  });

  it('writes states as they come, each once and the newest last', async () => {
    const { opened, written } = await openDocument({ diskText: 'hello' });

    for (const text of ['a', 'ab', 'abc']) {
      await typeAndContribute({ opened, doc: markdownDocument(text) });
    }
    await Effect.runPromise(opened.flush);

    expect(written[written.length - 1]).toBe('abc');
    expect(new Set(written).size).toBe(written.length);
  });

  it('holds a burst of typing and contributes its newest content once it pauses', async () => {
    const { opened, initialDocument, transformToText } = await openDocument({
      diskText: 'hello',
    });

    const contributions = ['a', 'ab', 'abc'].map((text) =>
      typeLeavingPending({ opened, doc: proseMirrorDocument(text) })
    );

    await vi.waitFor(() =>
      expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith('abc', {
        base: undefined,
      })
    );
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
    const { opened, written, transformToText } = await openDocument({
      diskText: 'hello',
    });

    const contribution = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    await Effect.runPromise(opened.flush);

    await expect(contribution).resolves.toBe(await versionOf(opened));
    expect(written).toEqual(['hello typed']);
    expect(transformToText).toHaveBeenCalledTimes(1);
  });

  it('drops pending typing on dropPendingLocalEdits', async () => {
    const { opened, written, initialDocument } = await openDocument({
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
    expect(written).toEqual([]);
  });

  it('contributes pending typing when it closes', async () => {
    const { opened, written } = await openDocument({ diskText: 'hello' });

    const contribution = typeLeavingPending({
      opened,
      doc: markdownDocument('hello world'),
    });
    await Effect.runPromise(opened.close);

    await expect(contribution).resolves.toBe(await versionOf(opened));
    expect(written).toContain('hello world');
  });

  it('raises to whoever waits for a flush when the write fails', async () => {
    const { opened } = await openDocument({
      diskText: 'hello',
      storeRefusesWrites: true,
    });

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });

    const failure = await Effect.runPromise(Effect.flip(opened.flush));

    expect(failure).toBeInstanceOf(RepositoryError);
  });

  it('raises to whoever waits for a flush when the typing cannot be converted, and writes nothing', async () => {
    const { opened, written, transformToText } = await openDocument({
      diskText: 'hello',
    });
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    const contribution = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    const failure = await Effect.runPromise(Effect.flip(opened.flush));

    expect(failure).toBeInstanceOf(RepresentationTransformError);
    expect(written).toEqual([]);

    // The typing is still on its way: the next flush writes it.
    await Effect.runPromise(opened.flush);

    await expect(contribution).resolves.toBe(await versionOf(opened));
    expect(written).toEqual(['hello typed']);
  });

  it('reports a write nobody awaited when it fails', async () => {
    const { opened, reportedErrors } = await openDocument({
      diskText: 'hello',
      storeRefusesWrites: true,
    });

    // Writes on the new state rather than awaiting a flush.
    await typeAndContribute({ opened, doc: markdownDocument('hello world') });

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(RepositoryError)
    );
  });

  it('reports the write it makes on opening, before anyone can listen', async () => {
    // The write happens while the document is being handed over, so what it
    // reports has to keep until its reader arrives.
    const { reportedErrors } = await openDocument({
      diskText: 'what the file has',
      liveText: 'what the share has',
      storeRefusesWrites: true,
    });

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(RepositoryError)
    );
  });

  it('passes on what the convergent document reports', async () => {
    const { reportedErrors, documents } = await openDocument({
      diskText: 'hello',
    });

    documents[0]!.report(
      new ConvergentDocumentUnavailableError('the document was deleted')
    );

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(
        ConvergentDocumentUnavailableError
      )
    );
  });

  it('flushes what the disk does not hold yet, and is idempotent', async () => {
    const { opened, written } = await openDocument({ diskText: 'hello' });

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });
    await Effect.runPromise(opened.flush);
    await Effect.runPromise(opened.flush);

    expect(written).toEqual(['hello world']);
  });

  it('writes what is pending when it closes', async () => {
    const { opened, written } = await openDocument({ diskText: 'hello' });

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });
    await Effect.runPromise(opened.close);

    expect(written).toContain('hello world');
  });

  it('closes and raises when the typing cannot be converted at close, writing nothing', async () => {
    const { opened, written, initialDocument, transformToText } =
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
    expect(written).toEqual([]);
  });

  it('carries content the document opened with to the file', async () => {
    // Joining a share opens the document on content the file does not have.
    const { written } = await openDocument({
      diskText: 'what the file has',
      liveText: 'what the share has',
    });

    await vi.waitFor(() => expect(written).toContain('what the share has'));
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

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });
    await Effect.runPromise(opened.flush);
    initialDocument.change.mockClear();

    // The watcher reports the write this document just made.
    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(initialDocument.change).not.toHaveBeenCalled();
  });

  it('keeps typing that arrives while its own write echoes back', async () => {
    const { opened, editDisk } = await openDocument({ diskText: 'hello' });

    await typeAndContribute({ opened, doc: markdownDocument('hello world') });
    await Effect.runPromise(opened.flush);
    // Typed after the write, before the watcher reported it: still on its
    // way to the document when the echo arrives.
    const contribution = typeLeavingPending({
      opened,
      doc: markdownDocument('hello world!'),
    });

    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));
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
    const { opened, editDisk, initialDocument, diskHolds } = await openDocument(
      {
        diskText: 'hello',
      }
    );
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
    await Effect.runPromise(opened.flush);

    await expect(contribution).resolves.toBe(await versionOf(opened));
    expect(contributionsTo(initialDocument)).toEqual([
      { text: 'hello DISK', base: versionOnDisk },
      { text: 'hello LOCAL', base: versionOnDisk },
    ]);
    expect(diskHolds()).toBe('hello DISK + hello LOCAL');
  });

  it('keeps working, silently, when the document is gone', async () => {
    const {
      opened,
      findDocumentById,
      notifyWatcher,
      reportedErrors,
      initialDocument,
    } = await openDocument({
      diskText: 'hello',
    });

    await typeAndContribute({ opened, doc: markdownDocument('hello typed') });
    initialDocument.change.mockClear();
    findDocumentById.mockReturnValue(
      Effect.fail(new NotFoundError('the document is gone'))
    );
    notifyWatcher();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(initialDocument.change).not.toHaveBeenCalled();
    expect(reportedErrors).toEqual([]);
  });

  it('reports a re-read of the file that fails', async () => {
    const { findDocumentById, notifyWatcher, reportedErrors } =
      await openDocument({
        diskText: 'hello',
      });
    findDocumentById.mockReturnValueOnce(
      Effect.fail(new RepositoryError('the store could not be read'))
    );

    notifyWatcher();

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(RepositoryError)
    );
  });

  it('stops following the file once closed', async () => {
    const { opened, editDisk, initialDocument } = await openDocument({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.close);
    initialDocument.change.mockClear();

    editDisk('after closing');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(initialDocument.change).not.toHaveBeenCalled();
  });
});

const shareLink = 'automerge:the-share' as ShareId;

describe('openLiveDocument, choosing its convergent document', () => {
  it('opens at the share when it has one', async () => {
    const { opened, documents } = await openDocument({
      diskText: 'what the file has',
      shareId: shareLink,
      sharedText: 'what the share has',
    });

    expect(documents).toHaveLength(1);
    const content = await contentOf(opened);
    expect(content).toBe('what the share has');
  });

  it('opens privately, reporting it, when the share cannot be opened', async () => {
    const { opened, documents, onShareUnavailable } = await openDocument({
      diskText: 'what the file has',
      shareId: shareLink,
      shareIsOutOfReach: true,
    });

    expect(onShareUnavailable).toHaveBeenCalledWith(
      expect.any(SharedDocumentUnavailableError)
    );
    // The unreachable share never became one of its documents.
    expect(documents).toHaveLength(1);
    const content = await contentOf(opened);
    expect(content).toBe('what the file has');
  });

  it('switches to the shared document on attaching, and closes the old one', async () => {
    const { opened, documents } = await openDocument({
      diskText: 'on its own',
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
    await Effect.runPromise(documents[1]!.publish('what a peer typed'));

    await vi.waitFor(async () => {
      const content = await contentOf(opened);
      expect(content).toBe('what a peer typed');
    });
  });

  it('carries what the shared document holds to the file', async () => {
    const { opened, written } = await openDocument({
      diskText: 'what the file has',
    });

    await Effect.runPromise(opened.attachTo(shareLink));

    await vi.waitFor(() => expect(written).toContain('what the share has'));
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
    });
    await Effect.runPromise(opened.attachTo(shareLink));

    await Effect.runPromise(opened.detach);

    expect(documents).toHaveLength(3);
    expect(documents[1]!.close).toHaveBeenCalledOnce();
    // Its own document again, holding what the share left it with.
    const content = await contentOf(opened);
    expect(content).toBe('what the share has');
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
    await Effect.runPromise(opened.attachTo(shareLink));

    documents[0]!.report(
      new ConvergentDocumentUnavailableError('from the document it left')
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(reportedErrors).toEqual([]);
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
      expect(documents[1]!.change).toHaveBeenLastCalledWith('changed outside', {
        base: versionAfterSwitch,
      })
    );
  });
});
