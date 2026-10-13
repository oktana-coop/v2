import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { subscribeToStream } from '../../../../utils/effect';
import {
  promiseWithResolvers,
  useFakeTimersInTest,
} from '../../../../utils/test-utils';
import {
  type ConvergentDocumentVersion,
  type EditContributor,
  LocalEditsContributionError,
  type RemotePresence,
} from '../../collaboration';
import {
  type ParticipantSelection,
  primaryRichTextDocument,
  type RichTextDocument,
} from '../models';
import {
  type RichTextConvergentDocument,
  type RichTextConvergentDocumentState,
} from '../ports';
import {
  markdownDocument,
  proseMirrorDocument,
  transformParagraphToText,
} from '../test-utils';
import { richTextEditing, type RichTextEditingDeps } from './rich-text-editing';

const createFakeConvergentDocument = async (initialText: string) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<RichTextConvergentDocumentState>({
      doc: primaryRichTextDocument(initialText),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence<ParticipantSelection>>>(
      []
    )
  );
  const change: Mock<RichTextConvergentDocument['change']> = vi.fn((doc) => {
    const version = `v${change.mock.calls.length}`;

    return pipe(
      SubscriptionRef.set(content, { doc, version }),
      Effect.as(version)
    );
  });
  const close = vi.fn();

  const document: RichTextConvergentDocument = {
    content,
    presence: { peers, publish: () => Effect.void },
    change,
    errors: Stream.empty,
    close: Effect.sync(close),
  };

  return { document, change, close };
};

type FakeConvergentDocument = Awaited<
  ReturnType<typeof createFakeConvergentDocument>
>;

// The contributor on a document with nothing behind it: no disk, no share.
const startEditing = async ({
  initialText = 'hello',
}: { initialText?: string } = {}) => {
  const document = await createFakeConvergentDocument(initialText);
  const transformToText = vi.fn<RichTextEditingDeps['transformToText']>(
    transformParagraphToText
  );

  const contributor = await Effect.runPromise(
    richTextEditing({ transformToText })(document.document)
  );

  // What the contributor reported while nobody was waiting.
  const reportedErrors: LocalEditsContributionError[] = [];
  subscribeToStream(contributor.errors, (error) => {
    reportedErrors.push(error);
  });

  return { contributor, document, transformToText, reportedErrors };
};

// Types content and leaves it on its way, as typing that has not paused.
// Resolves with its version once it reaches the document.
const typeLeavingPending = ({
  contributor,
  doc,
  base,
}: {
  contributor: EditContributor<RichTextDocument>;
  doc: RichTextDocument;
  base?: ConvergentDocumentVersion;
}) => Effect.runPromise(contributor.edit(doc, { base }));

// Types content and waits for it to reach the document, without the pause
// that normally contributes it.
const typeAndContribute = async ({
  contributor,
  doc,
  base,
}: {
  contributor: EditContributor<RichTextDocument>;
  doc: RichTextDocument;
  base?: ConvergentDocumentVersion;
}) => {
  const contribution = typeLeavingPending({ contributor, doc, base });
  await Effect.runPromise(contributor.applyPendingLocalEdits);
  return contribution;
};

const contentOf = (document: FakeConvergentDocument) =>
  Effect.runPromise(SubscriptionRef.get(document.document.content)).then(
    (current) => current.doc.content
  );

// What reached the document, in order.
const contributionsTo = (document: FakeConvergentDocument) =>
  document.change.mock.calls.map(([doc, options]) => ({
    text: doc.content,
    base: options?.base,
  }));

describe('richTextEditing', () => {
  it('contributes pending typing as primary text on applyPendingLocalEdits', async () => {
    const { contributor, document } = await startEditing();

    const contribution = typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello typed'),
    });
    await Effect.runPromise(contributor.applyPendingLocalEdits);

    await expect(contribution).resolves.toBe('v1');
    expect(document.change).toHaveBeenCalledExactlyOnceWith(
      markdownDocument('hello typed'),
      {
        base: undefined,
      }
    );
    const content = await contentOf(document);
    expect(content).toBe('hello typed');
  });

  it('drops pending typing on dropPendingLocalEdits', async () => {
    const { contributor, document } = await startEditing();

    const contribution = typeLeavingPending({
      contributor,
      doc: primaryRichTextDocument('restored old state'),
    });
    await Effect.runPromise(contributor.dropPendingLocalEdits);
    await Effect.runPromise(contributor.applyPendingLocalEdits);

    // Whoever waited for it is released, with the version the document holds.
    await expect(contribution).resolves.toBe('v0');
    expect(document.change).not.toHaveBeenCalled();
    const content = await contentOf(document);
    expect(content).toBe('hello');
  });

  it('closes the document without contributing pending typing', async () => {
    const { contributor, document } = await startEditing();
    useFakeTimersInTest();

    typeLeavingPending({
      contributor,
      doc: primaryRichTextDocument('hello world'),
    });
    await Effect.runPromise(contributor.close(document.document.close));

    expect(document.close).toHaveBeenCalledOnce();
    // Lets the contribution debounce elapse; close must have cancelled it.
    await vi.runAllTimersAsync();
    expect(document.change).not.toHaveBeenCalled();
  });

  it('closes the document once a contribution in flight has reached it', async () => {
    const conversion = promiseWithResolvers<string>();
    const { contributor, document, transformToText } = await startEditing();
    transformToText.mockReturnValueOnce(conversion.promise);
    useFakeTimersInTest();

    typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello typed'),
    });
    const applying = Effect.runPromise(contributor.applyPendingLocalEdits);
    const closing = Effect.runPromise(
      contributor.close(document.document.close)
    );
    // Lets everything else run; close waits for the contribution in flight.
    await vi.runAllTimersAsync();

    expect(document.close).not.toHaveBeenCalled();

    conversion.resolve('hello typed');
    await Promise.all([applying, closing]);

    expect(document.change).toHaveBeenCalledExactlyOnceWith(
      markdownDocument('hello typed'),
      {
        base: undefined,
      }
    );
    expect(document.close).toHaveBeenCalledOnce();
  });

  it('contributes typing anchored at the base it names', async () => {
    const { contributor, document } = await startEditing({
      initialText: 'note',
    });

    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('note one'),
      base: 'v0',
    });
    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('note one two'),
      base: 'v1',
    });

    expect(contributionsTo(document)).toEqual([
      { text: 'note one', base: 'v0' },
      { text: 'note one two', base: 'v1' },
    ]);
  });

  // The contributor recognises that each edit extends the one before it,
  // because they share a base. So instead of anchoring every edit at v0, which
  // would make each look concurrent with the others, it anchors each one at
  // the version the previous edit resolved with.
  it('anchors typing sharing a base at the contribution before it', async () => {
    const { contributor, document } = await startEditing({
      initialText: 'note',
    });

    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('note one'),
      base: 'v0',
    });
    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('note one two'),
      base: 'v0',
    });
    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('note one two three'),
      base: 'v0',
    });

    expect(contributionsTo(document)).toEqual([
      { text: 'note one', base: 'v0' },
      { text: 'note one two', base: 'v1' },
      { text: 'note one two three', base: 'v2' },
    ]);
  });

  it('treats local edits and edits from another source sharing a base as concurrent', async () => {
    const { contributor, document } = await startEditing();

    // Through the document's change rather than edit: an edit from another
    // source.
    await Effect.runPromise(
      document.document.change(primaryRichTextDocument('hello DISK'), {
        base: 'v0',
      })
    );
    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('hello LOCAL'),
      base: 'v0',
    });

    expect(contributionsTo(document)).toEqual([
      { text: 'hello DISK', base: 'v0' },
      { text: 'hello LOCAL', base: 'v0' },
    ]);
  });

  it('does not anchor typing at an edit made before forgetting past contributions', async () => {
    const { contributor, document } = await startEditing();

    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('hello typed'),
      base: 'v0',
    });
    await Effect.runPromise(contributor.forgetPastContributions);
    // The base now names the opening state of a document switched to, so what
    // was applied before must not anchor it.
    await typeAndContribute({
      contributor,
      doc: primaryRichTextDocument('hello typed more'),
      base: 'v0',
    });

    expect(contributionsTo(document)).toEqual([
      { text: 'hello typed', base: 'v0' },
      { text: 'hello typed more', base: 'v0' },
    ]);
  });

  it('raises when pending typing cannot be converted, and contributes it on the next attempt', async () => {
    const { contributor, document, transformToText } = await startEditing();
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    const contribution = typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello typed'),
    });
    const failure = await Effect.runPromise(
      Effect.flip(contributor.applyPendingLocalEdits)
    );

    expect(failure).toBeInstanceOf(LocalEditsContributionError);
    expect(document.change).not.toHaveBeenCalled();

    // The next attempt carries it.
    await Effect.runPromise(contributor.applyPendingLocalEdits);

    await expect(contribution).resolves.toBe('v1');
    expect(document.change).toHaveBeenCalledExactlyOnceWith(
      markdownDocument('hello typed'),
      {
        base: undefined,
      }
    );
  });

  it('resolves typing that failed to contribute with the typing that carries it', async () => {
    const firstConversion = promiseWithResolvers<string>();
    const { contributor, document, transformToText } = await startEditing();
    transformToText.mockReturnValueOnce(firstConversion.promise);

    const first = typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello a'),
    });
    const applying = Effect.runPromise(
      Effect.flip(contributor.applyPendingLocalEdits)
    );
    await vi.waitFor(() => expect(transformToText).toHaveBeenCalledTimes(1));
    // Typed while the first contribution was converting: it carries it.
    const second = typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello ab'),
    });
    firstConversion.reject(new Error('the conversion failed'));

    expect(await applying).toBeInstanceOf(LocalEditsContributionError);

    await Effect.runPromise(contributor.applyPendingLocalEdits);

    await expect(first).resolves.toBe('v1');
    await expect(second).resolves.toBe('v1');
    expect(document.change).toHaveBeenCalledExactlyOnceWith(
      markdownDocument('hello ab'),
      {
        base: undefined,
      }
    );
  });

  it('reports a failed conversion nobody awaited', async () => {
    const { contributor, document, reportedErrors, transformToText } =
      await startEditing();
    transformToText.mockRejectedValueOnce(new Error('the conversion failed'));

    // Contributed by the pause rather than by anyone awaiting it.
    typeLeavingPending({
      contributor,
      doc: proseMirrorDocument('hello typed'),
    });

    await vi.waitFor(() =>
      expect(reportedErrors[0]).toBeInstanceOf(LocalEditsContributionError)
    );
    expect(document.change).not.toHaveBeenCalled();
  });
});
