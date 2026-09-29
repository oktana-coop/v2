import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type RemotePresence,
  RepresentationTransformError,
} from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { subscribeToStream } from '../../../../../utils/effect';
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
} from '../test-utils';
import {
  createLiveDocument,
  type CreateLiveDocumentDeps,
} from './create-live-document';
import { type LiveDocumentError } from './live-document';

const documentId = '/blob/main/note.md' as ArtifactId;

const createFakeConvergentDocument = async (initialText: string) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(initialText),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );
  const change: Mock<ConvergentDocument['change']> = vi.fn((text) => {
    const version = `v${change.mock.calls.length}`;

    return pipe(
      SubscriptionRef.set(content, { doc: markdownDocument(text), version }),
      Effect.as(version)
    );
  });
  const close = vi.fn();

  const document: ConvergentDocument = {
    content,
    presence: { peers, publish: () => Effect.void },
    change,
    errors: Stream.empty,
    close: Effect.sync(close),
  };

  return { document, change, close };
};

// A live document with nothing behind it: no disk, no share.
const openDocument = async ({
  initialText = 'hello',
}: { initialText?: string } = {}) => {
  const fake = await createFakeConvergentDocument(initialText);
  const transformToText = vi.fn<CreateLiveDocumentDeps['transformToText']>(
    transformParagraphToText
  );

  const documents = [fake];

  const opened = await Effect.runPromise(
    createLiveDocument({
      createPrivateDocument: (text) =>
        Effect.promise(async () => {
          const next = await createFakeConvergentDocument(text);
          documents.push(next);
          return next.document;
        }),
      openSharedDocument: () => Effect.die('no share in these tests'),
      transformToText,
    })({ documentId, initialDocument: fake.document })
  );

  // What the document reported while nobody was waiting.
  const reportedErrors: LiveDocumentError[] = [];
  subscribeToStream(opened.errors, (error) => {
    reportedErrors.push(error);
  });

  return {
    opened,
    initialDocument: fake,
    documents,
    reportedErrors,
    transformToText,
  };
};

describe('createLiveDocument, with nothing behind it', () => {
  it('contributes pending typing as primary text on applyPendingLocalEdits', async () => {
    const { opened, initialDocument } = await openDocument();

    const contribution = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    await Effect.runPromise(opened.applyPendingLocalEdits);

    await expect(contribution).resolves.toBe('v1');
    expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith(
      'hello typed',
      { base: undefined }
    );
    const content = await contentOf(opened);
    expect(content).toBe('hello typed');
  });

  it('drops pending typing on dropPendingLocalEdits', async () => {
    const { opened, initialDocument } = await openDocument();

    const contribution = typeLeavingPending({
      opened,
      doc: markdownDocument('restored old state'),
    });
    await Effect.runPromise(opened.dropPendingLocalEdits);
    await Effect.runPromise(opened.applyPendingLocalEdits);

    // Whoever waited for it is released, with the version the document holds.
    await expect(contribution).resolves.toBe('v0');
    expect(initialDocument.change).not.toHaveBeenCalled();
    const content = await contentOf(opened);
    expect(content).toBe('hello');
  });

  it('closes the convergent document without contributing pending typing', async () => {
    const { opened, initialDocument } = await openDocument();
    useFakeTimersInTest();

    typeLeavingPending({ opened, doc: markdownDocument('hello world') });
    await Effect.runPromise(opened.close);

    expect(initialDocument.close).toHaveBeenCalledOnce();
    // Lets the contribution debounce elapse; close must have cancelled it.
    await vi.runAllTimersAsync();
    expect(initialDocument.change).not.toHaveBeenCalled();
  });

  it('closes once a contribution in flight has reached the document', async () => {
    const conversion = promiseWithResolvers<string>();
    const { opened, initialDocument, transformToText } = await openDocument();
    transformToText.mockReturnValueOnce(conversion.promise);
    useFakeTimersInTest();

    typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    const applying = Effect.runPromise(opened.applyPendingLocalEdits);
    const closing = Effect.runPromise(opened.close);
    // Lets everything else run; close waits for the contribution in flight.
    await vi.runAllTimersAsync();

    expect(initialDocument.close).not.toHaveBeenCalled();

    conversion.resolve('hello typed');
    await Promise.all([applying, closing]);

    expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith(
      'hello typed',
      { base: undefined }
    );
    expect(initialDocument.close).toHaveBeenCalledOnce();
  });

  it('contributes typing anchored at the base it names', async () => {
    const { opened, initialDocument } = await openDocument({
      initialText: 'note',
    });

    await typeAndContribute({
      opened,
      doc: markdownDocument('note one'),
      base: 'v0',
    });
    await typeAndContribute({
      opened,
      doc: markdownDocument('note one two'),
      base: 'v1',
    });

    expect(contributionsTo(initialDocument)).toEqual([
      { text: 'note one', base: 'v0' },
      { text: 'note one two', base: 'v1' },
    ]);
  });

  it('contributes an edit from another source anchored at the base it derives from', async () => {
    const { opened, initialDocument } = await openDocument();

    // Through change rather than edit: an edit from another source.
    const version = await Effect.runPromise(
      opened.change('hello from elsewhere', { base: 'v0' })
    );

    expect(version).toBe('v1');
    expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith(
      'hello from elsewhere',
      { base: 'v0' }
    );
    const content = await contentOf(opened);
    expect(content).toBe('hello from elsewhere');
  });

  // The live document recognises that each edit extends the one before it,
  // because they share a base. So instead of anchoring every edit at v0, which
  // would make each look concurrent with the others, it anchors each one at
  // the version the previous edit resolved with.
  it('anchors typing sharing a base at the contribution before it', async () => {
    const { opened, initialDocument } = await openDocument({
      initialText: 'note',
    });

    await typeAndContribute({
      opened,
      doc: markdownDocument('note one'),
      base: 'v0',
    });
    await typeAndContribute({
      opened,
      doc: markdownDocument('note one two'),
      base: 'v0',
    });
    await typeAndContribute({
      opened,
      doc: markdownDocument('note one two three'),
      base: 'v0',
    });

    expect(contributionsTo(initialDocument)).toEqual([
      { text: 'note one', base: 'v0' },
      { text: 'note one two', base: 'v1' },
      { text: 'note one two three', base: 'v2' },
    ]);
  });

  it('treats local edits and edits from another source sharing a base as concurrent', async () => {
    const { opened, initialDocument } = await openDocument();

    // Through change rather than edit: an edit from another source.
    await Effect.runPromise(opened.change('hello DISK', { base: 'v0' }));
    await typeAndContribute({
      opened,
      doc: markdownDocument('hello LOCAL'),
      base: 'v0',
    });

    expect(contributionsTo(initialDocument)).toEqual([
      { text: 'hello DISK', base: 'v0' },
      { text: 'hello LOCAL', base: 'v0' },
    ]);
  });

  it('does not anchor typing at an edit made on the document it left', async () => {
    const { opened, documents } = await openDocument();

    await typeAndContribute({
      opened,
      doc: markdownDocument('hello typed'),
      base: 'v0',
    });
    await Effect.runPromise(opened.detach);
    // Both documents open at v0. Here the base names the new document's
    // opening state, so what was applied on the old one must not anchor it.
    await typeAndContribute({
      opened,
      doc: markdownDocument('hello typed more'),
      base: 'v0',
    });

    expect(documents[1]?.change).toHaveBeenCalledExactlyOnceWith(
      'hello typed more',
      { base: 'v0' }
    );
  });

  it('raises when pending typing cannot be converted, and contributes it on the next attempt', async () => {
    const { opened, initialDocument, transformToText } = await openDocument();
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    const contribution = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    const failure = await Effect.runPromise(
      Effect.flip(opened.applyPendingLocalEdits)
    );

    expect(failure).toBeInstanceOf(RepresentationTransformError);
    expect(initialDocument.change).not.toHaveBeenCalled();

    // The next attempt carries it.
    await Effect.runPromise(opened.applyPendingLocalEdits);

    await expect(contribution).resolves.toBe('v1');
    expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith(
      'hello typed',
      { base: undefined }
    );
  });

  it('resolves typing that failed to contribute with the typing that carries it', async () => {
    const firstConversion = promiseWithResolvers<string>();
    const { opened, initialDocument, transformToText } = await openDocument();
    transformToText.mockReturnValueOnce(firstConversion.promise);

    const first = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello a'),
    });
    const applying = Effect.runPromise(
      Effect.flip(opened.applyPendingLocalEdits)
    );
    await vi.waitFor(() => expect(transformToText).toHaveBeenCalledTimes(1));
    // Typed while the first contribution was converting: it carries it.
    const second = typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello ab'),
    });
    firstConversion.reject(new Error('the conversion failed'));

    expect(await applying).toBeInstanceOf(RepresentationTransformError);

    await Effect.runPromise(opened.applyPendingLocalEdits);

    await expect(first).resolves.toBe('v1');
    await expect(second).resolves.toBe('v1');
    expect(initialDocument.change).toHaveBeenCalledExactlyOnceWith('hello ab', {
      base: undefined,
    });
  });

  it('reports a failed conversion nobody awaited', async () => {
    const { opened, initialDocument, reportedErrors, transformToText } =
      await openDocument();
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    // Contributed by the pause rather than by anyone awaiting it.
    typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(RepresentationTransformError)
    );
    expect(initialDocument.change).not.toHaveBeenCalled();
  });

  it('does not switch documents when pending typing cannot be contributed', async () => {
    const { opened, initialDocument, documents, transformToText } =
      await openDocument();
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    typeLeavingPending({
      opened,
      doc: proseMirrorDocument('hello typed'),
    });
    const failure = await Effect.runPromise(Effect.flip(opened.detach));

    expect(failure).toBeInstanceOf(RepresentationTransformError);
    expect(documents).toHaveLength(1);
    expect(initialDocument.close).not.toHaveBeenCalled();
  });
});
