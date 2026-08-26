import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentError,
  type ConvergentDocumentState,
  ConvergentDocumentUnavailableError,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type ResolvedDocument,
  type RichTextDocument,
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
import { type ProjectStore, type ShareUrl } from '../ports';
import { type LiveDocument, type LiveDocumentError } from './live-document';
import { openLiveDocument } from './open-live-document';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;

// A convergent document holding text, versioned by a counter. Contributions
// anchored at an older version merge rather than replace, as the real one
// does; that is what the disk relies on.
let documentsEverCreated = 0;

const createFakeConvergentDocument = async (initialText: string) => {
  // Versions carry which document minted them, as heads do: no version of one
  // document is ever a version of another.
  const documentName = `d${(documentsEverCreated += 1)}`;
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdown(initialText),
      version: `${documentName}.0`,
    })
  );
  const errorChannel =
    await Effect.runPromise(createErrorChannel<ConvergentDocumentError>());
  let versions = 0;
  const contributions: Array<{ text: string; base?: string }> = [];

  const publish = (text: string) => {
    versions += 1;
    const version = `${documentName}.${versions}`;

    return pipe(
      SubscriptionRef.set(content, { doc: markdown(text), version }),
      Effect.as(version)
    );
  };

  let closed = false;

  const document: ConvergentDocument = {
    content,
    change: (text, options) =>
      pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) => {
          contributions.push({ text, base: options?.base });

          // An anchored contribution keeps what it had not seen.
          const merged =
            options?.base !== undefined && options.base !== current.version
              ? `${current.doc.content} + ${text}`
              : text;

          return publish(merged);
        })
      ),
    errors: Stream.fromPubSub(errorChannel),
    close: Effect.sync(() => {
      closed = true;
    }),
  };

  return {
    document,
    contributions,
    publish,
    wasClosed: () => closed,
    // Something going wrong with this document, with nobody waiting on it.
    report: (error: ConvergentDocumentError) =>
      Effect.runSync(PubSub.publish(errorChannel, error)),
  };
};

type FakeConvergentDocument = Awaited<
  ReturnType<typeof createFakeConvergentDocument>
>;

const open = async ({
  diskText = 'on disk',
  liveText = diskText,
  shareUrl,
  sharedText = 'what the share has',
  shareIsOutOfReach = false,
  storeRefusesWrites = false,
}: {
  diskText?: string;
  liveText?: string;
  shareUrl?: ShareUrl;
  sharedText?: string;
  shareIsOutOfReach?: boolean;
  storeRefusesWrites?: boolean;
} = {}) => {
  let onDisk = diskText;
  let documentGone = false;
  const written: string[] = [];
  const onShareUnavailable = vi.fn();
  let watcher: (() => void) | undefined;

  // Every document the live document has run on, in the order it ran on them.
  const documents: FakeConvergentDocument[] = [];

  const startOn = (text: string) =>
    Effect.promise(async () => {
      const fake = await createFakeConvergentDocument(text);
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

  const findDocumentById: ProjectStore['findDocumentById'] = () =>
    Effect.suspend(() =>
      documentGone
        ? Effect.fail(new NotFoundError('the document is gone'))
        : Effect.succeed<ResolvedDocument>({
            id: documentId,
            artifact: markdown(onDisk),
          })
    );

  const opened = await Effect.runPromise(
    openLiveDocument({
      createPrivateDocument,
      openSharedDocument,
      onShareUnavailable,
      // `pm:` marks content that went through the conversion.
      transformToText: vi.fn(async ({ input }: { input: string }) =>
        input.replace(/^pm:/, '')
      ),
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
    })({ projectId, documentId, shareUrl })
  );

  // What the document reported while nobody was waiting. Subscribing after it
  // opened still catches what went wrong while it was opening.
  const reported: LiveDocumentError[] = [];
  subscribeToStream(opened.errors, (error) => {
    reported.push(error);
  });

  return {
    opened,
    written,
    documents,
    reported,
    // The document the live document is running on right now.
    current: () => documents[documents.length - 1]!,
    contributions: documents[0]!.contributions,
    onShareUnavailable,
    // An edit made by another hand, reported like the watcher would.
    editDisk: (text: string) => {
      onDisk = text;
      watcher?.();
    },
    loseDocument: () => {
      documentGone = true;
      watcher?.();
    },
    diskHolds: () => onDisk,
  };
};

describe('openLiveDocument', () => {
  it('opens on what the store holds and writes nothing', async () => {
    const { written } = await open({ diskText: 'hello' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(written).toEqual([]);
  });

  it('writes what the document holds once the timer passes', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));

    await vi.waitFor(() => expect(written).toContain('hello world'));
  });

  it('coalesces a burst into one write of the last content', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    for (const text of ['a', 'ab', 'abc']) {
      await Effect.runPromise(opened.change(markdown(text)));
    }
    await Effect.runPromise(opened.flush);

    expect(written).toEqual(['abc']);
  });

  it('raises to whoever waits for a flush when the write fails', async () => {
    const { opened, reported } = await open({
      diskText: 'hello',
      storeRefusesWrites: true,
    });

    await Effect.runPromise(opened.change(markdown('hello world')));

    const failure = await Effect.runPromise(Effect.flip(opened.flush));

    expect(failure).toBeInstanceOf(RepositoryError);
    // The caller was told; nothing was reported behind their back.
    expect(reported).toEqual([]);
  });

  it('reports a write nobody awaited when it fails', async () => {
    const { opened, reported } = await open({
      diskText: 'hello',
      storeRefusesWrites: true,
    });

    // Arms a write on the timer rather than awaiting one.
    await Effect.runPromise(opened.change(markdown('hello world')));

    await vi.waitFor(() => expect(reported[0]).toBeInstanceOf(RepositoryError));
  });

  it('reports the write it makes on opening, before anyone can listen', async () => {
    // The write happens while the document is being handed over, so what it
    // reports has to keep until its reader arrives.
    const { reported } = await open({
      diskText: 'what the file has',
      liveText: 'what the share has',
      storeRefusesWrites: true,
    });

    await vi.waitFor(() => expect(reported[0]).toBeInstanceOf(RepositoryError));
  });

  it('passes on what the document it runs on reports', async () => {
    const { reported, documents } = await open({ diskText: 'hello' });

    documents[0]!.report(
      new ConvergentDocumentUnavailableError('the document was deleted')
    );

    await vi.waitFor(() =>
      expect(reported[0]).toBeInstanceOf(ConvergentDocumentUnavailableError)
    );
  });

  it('flushes without waiting for the timer, and is idempotent', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    await Effect.runPromise(opened.flush);

    expect(written).toEqual(['hello world']);
  });

  it('drops an armed write on cancelPendingPersist', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('restored old state')));
    await Effect.runPromise(opened.cancelPendingPersist);
    await Effect.runPromise(opened.flush);

    expect(written).toEqual([]);
  });

  it('writes what is pending when it closes', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.close);

    expect(written).toContain('hello world');
  });

  it('carries content the document opened with to the file', async () => {
    // Joining a share opens the document on content the file does not have.
    const { written } = await open({
      diskText: 'what the file has',
      liveText: 'what the share has',
    });

    await vi.waitFor(() => expect(written).toContain('what the share has'));
  });

  it('picks up a change made outside the app', async () => {
    const { opened, editDisk } = await open({ diskText: 'hello' });

    editDisk('changed outside');

    await vi.waitFor(async () => {
      const current = await Effect.runPromise(
        SubscriptionRef.get(opened.content)
      );
      expect(current.doc.content).toContain('changed outside');
    });
  });

  it('ignores the echo of its own write', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    const contributedBefore = contributions.length;

    // The watcher reports the write this document just made.
    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
  });

  it('keeps typing that arrives while its own write echoes back', async () => {
    const { opened, editDisk } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    // Typed after the write, before the watcher reported it.
    await Effect.runPromise(opened.change(markdown('hello world!')));

    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const current = await Effect.runPromise(
      SubscriptionRef.get(opened.content)
    );
    expect(current.doc.content).toBe('hello world!');
  });

  it('anchors an outside change at the version the file derives from', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello typed')));
    await Effect.runPromise(opened.flush);
    const versionOnDisk = await Effect.runPromise(
      SubscriptionRef.get(opened.content)
    ).then((current) => current.version);

    editDisk('hello from elsewhere');
    await vi.waitFor(() =>
      expect(contributions[contributions.length - 1]?.text).toBe(
        'hello from elsewhere'
      )
    );

    expect(contributions[contributions.length - 1]?.base).toBe(versionOnDisk);
  });

  it('keeps working, silently, when the document is gone', async () => {
    const { opened, loseDocument, reported, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello typed')));
    const contributedBefore = contributions.length;
    loseDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
    expect(reported).toEqual([]);
  });

  it('stops following the file once closed', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.close);
    const contributedBefore = contributions.length;

    editDisk('after closing');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
  });
});

const shareLink = 'automerge:the-share' as ShareUrl;

const lastOf = <A>(items: A[]): A | undefined => items[items.length - 1];

const contentOf = (opened: { content: LiveDocument['content'] }) =>
  Effect.runPromise(SubscriptionRef.get(opened.content)).then(
    (shown) => shown.doc.content
  );

describe('openLiveDocument, on the document it runs on', () => {
  it('opens at the share when it has one', async () => {
    const { opened, documents } = await open({
      diskText: 'what the file has',
      shareUrl: shareLink,
      sharedText: 'what the share has',
    });

    expect(documents).toHaveLength(1);
    await expect(contentOf(opened)).resolves.toBe('what the share has');
  });

  it('opens privately, reporting it, when the share cannot be opened', async () => {
    const { opened, documents, onShareUnavailable } = await open({
      diskText: 'what the file has',
      shareUrl: shareLink,
      shareIsOutOfReach: true,
    });

    expect(onShareUnavailable).toHaveBeenCalledWith(
      expect.any(SharedDocumentUnavailableError)
    );
    // The failed one never became a document to run on.
    expect(documents).toHaveLength(1);
    await expect(contentOf(opened)).resolves.toBe('what the file has');
  });

  it('runs on the shared document after attaching, and closes the old one', async () => {
    const { opened, documents } = await open({ diskText: 'on its own' });

    await Effect.runPromise(opened.attachTo(shareLink));

    expect(documents).toHaveLength(2);
    expect(documents[0]!.wasClosed()).toBe(true);
    await expect(contentOf(opened)).resolves.toBe('what the share has');
  });

  it('contributes to the document it switched to, not the one it left', async () => {
    const { opened, documents } = await open({ diskText: 'on its own' });
    await Effect.runPromise(opened.attachTo(shareLink));
    const contributedBefore = documents[0]!.contributions.length;

    await Effect.runPromise(opened.change(markdown('typed while shared')));

    expect(documents[0]!.contributions).toHaveLength(contributedBefore);
    expect(lastOf(documents[1]!.contributions)?.text).toBe(
      'typed while shared'
    );
  });

  it('follows the document it switched to', async () => {
    const { opened, documents } = await open({ diskText: 'on its own' });
    await Effect.runPromise(opened.attachTo(shareLink));

    // A peer's change, published by the document the live one now runs on.
    await Effect.runPromise(documents[1]!.publish('what a peer typed'));

    await vi.waitFor(async () =>
      expect(await contentOf(opened)).toBe('what a peer typed')
    );
  });

  it('carries what the shared document holds to the file', async () => {
    const { opened, written } = await open({ diskText: 'what the file has' });

    await Effect.runPromise(opened.attachTo(shareLink));

    await vi.waitFor(() => expect(written).toContain('what the share has'));
  });

  it('runs on a private document after detaching, keeping the content', async () => {
    const { opened, documents } = await open({ diskText: 'on its own' });
    await Effect.runPromise(opened.attachTo(shareLink));

    await Effect.runPromise(opened.detach);

    expect(documents).toHaveLength(3);
    expect(documents[1]!.wasClosed()).toBe(true);
    // Its own document again, holding what the share left it with.
    await expect(contentOf(opened)).resolves.toBe('what the share has');
  });

  it('passes on what the document it switched to reports', async () => {
    const { opened, documents, reported } = await open({
      diskText: 'on its own',
    });
    await Effect.runPromise(opened.attachTo(shareLink));

    documents[1]!.report(
      new ConvergentDocumentUnavailableError('the share went away')
    );

    await vi.waitFor(() =>
      expect(reported).toContainEqual(
        expect.any(ConvergentDocumentUnavailableError)
      )
    );
  });

  it('stops passing on what the document it left reports', async () => {
    const { opened, documents, reported } = await open({
      diskText: 'on its own',
    });
    await Effect.runPromise(opened.attachTo(shareLink));

    documents[0]!.report(
      new ConvergentDocumentUnavailableError('from the document it left')
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(reported).toEqual([]);
  });

  it('anchors a later disk change in the document it switched to', async () => {
    const { opened, documents, editDisk } = await open({
      diskText: 'what the file has',
    });
    await Effect.runPromise(opened.attachTo(shareLink));
    const attached = documents[1]!;
    const versionAfterSwitch = await Effect.runPromise(
      SubscriptionRef.get(opened.content)
    ).then((shown) => shown.version);

    editDisk('changed outside');

    await vi.waitFor(() =>
      expect(lastOf(attached.contributions)?.text).toBe('changed outside')
    );
    // A base from the document it left would be dropped by the new one.
    expect(lastOf(attached.contributions)?.base).toBe(versionAfterSwitch);
  });
});
