import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Mock, vi } from 'vitest';

import {
  type RichTextConvergentDocument,
  type RichTextConvergentDocumentState,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import { primaryRichTextDocument } from '../../../../modules/domain/rich-text';
import {
  markdownDocument,
  proseMirrorDocument,
  transformParagraphToText,
} from '../../../../modules/domain/rich-text/test-utils';
import { type ConvergentDocumentVersion } from '../../collaboration';
import { type LiveRichTextDocument } from './open-live-rich-text-document';

export {
  markdownDocument,
  primaryRichTextDocument,
  proseMirrorDocument,
  transformParagraphToText,
};
export {
  promiseWithResolvers,
  useFakeTimersInTest,
} from '../../../../utils/test-utils';

// Types content and waits for it to reach the document, without the pause
// that normally contributes it.
export const typeAndContribute = async ({
  opened,
  doc,
  base,
}: {
  opened: Pick<LiveRichTextDocument, 'edit' | 'applyPendingLocalEdits'>;
  doc: RichTextDocument;
  base?: ConvergentDocumentVersion;
}) => {
  const contribution = Effect.runPromise(opened.edit(doc, { base }));
  await Effect.runPromise(opened.applyPendingLocalEdits);
  return contribution;
};

// Types content and leaves it on its way, as typing that has not paused.
// Resolves with its version once it reaches the document.
export const typeLeavingPending = ({
  opened,
  doc,
  base,
}: {
  opened: Pick<LiveRichTextDocument, 'edit'>;
  doc: RichTextDocument;
  base?: ConvergentDocumentVersion;
}) => Effect.runPromise(opened.edit(doc, { base }));

export const contentOf = (opened: Pick<LiveRichTextDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(opened.content)).then(
    (current) => current.doc.content
  );

// What reached a convergent document whose `change` is spied on, in order.
export const contributionsTo = (document: {
  change: Mock<RichTextConvergentDocument['change']>;
}) =>
  document.change.mock.calls.map(([doc, options]) => ({
    text: doc.content,
    base: options?.base,
  }));

export const versionOf = (
  document: Pick<RichTextConvergentDocument, 'content'>
) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (current) => current.version
  );

// A live document showing fixed content, whose operations are spied on.
export const createFakeLiveDocument = async () => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<RichTextConvergentDocumentState>({
      doc: primaryRichTextDocument('what the editor shows'),
      version: 'v0',
    })
  );
  const applyPendingLocalEdits = vi.fn<
    () => LiveRichTextDocument['applyPendingLocalEdits']
  >(() => Effect.void);
  const attachTo = vi.fn<LiveRichTextDocument['attachTo']>(() => Effect.void);
  const detach = vi.fn<() => LiveRichTextDocument['detach']>(() => Effect.void);
  const close = vi.fn<() => Effect.Effect<void>>(() => Effect.void);

  const liveDocument: Pick<
    LiveRichTextDocument,
    | 'content'
    | 'currentDocument'
    | 'applyPendingLocalEdits'
    | 'attachTo'
    | 'detach'
  > & { close: Effect.Effect<void> } = {
    content,
    currentDocument: Effect.map(
      SubscriptionRef.get(content),
      (current) => current.doc
    ),
    applyPendingLocalEdits: Effect.suspend(applyPendingLocalEdits),
    attachTo,
    detach: Effect.suspend(detach),
    close: Effect.suspend(close),
  };

  return { liveDocument, applyPendingLocalEdits, attachTo, detach, close };
};
