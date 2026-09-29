import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Mock, onTestFinished, vi } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type ConvergentDocumentVersion,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import { type LiveDocument } from './live-document';

export const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

type ParagraphPMJSON = {
  type: 'doc';
  content: [{ type: 'paragraph'; content: [{ type: 'text'; text: string }] }];
};

export const proseMirrorDocument = (text: string): RichTextDocument => {
  const json: ParagraphPMJSON = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    representation: richTextRepresentations.PROSEMIRROR,
    content: JSON.stringify(json),
  };
};

export const transformParagraphToText = async ({ input }: { input: string }) =>
  (JSON.parse(input) as ParagraphPMJSON).content[0].content[0].text;

// Types content and waits for it to reach the document, without the pause
// that normally contributes it.
export const typeAndContribute = async ({
  opened,
  doc,
  base,
}: {
  opened: Pick<LiveDocument, 'edit' | 'applyPendingLocalEdits'>;
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
  opened: Pick<LiveDocument, 'edit'>;
  doc: RichTextDocument;
  base?: ConvergentDocumentVersion;
}) => Effect.runPromise(opened.edit(doc, { base }));

export const contentOf = (opened: Pick<LiveDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(opened.content)).then(
    (current) => current.doc.content
  );

// What reached a convergent document whose `change` is spied on, in order.
export const contributionsTo = (document: {
  change: Mock<ConvergentDocument['change']>;
}) =>
  document.change.mock.calls.map(([text, options]) => ({
    text,
    base: options?.base,
  }));

export const versionOf = (document: Pick<ConvergentDocument, 'content'>) =>
  Effect.runPromise(SubscriptionRef.get(document.content)).then(
    (current) => current.version
  );

// A live document showing fixed content, whose operations are spied on.
export const createFakeLiveDocument = async () => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument('what the editor shows'),
      version: 'v0',
    })
  );
  const applyPendingLocalEdits = vi.fn<
    () => LiveDocument['applyPendingLocalEdits']
  >(() => Effect.void);
  const attachTo = vi.fn<LiveDocument['attachTo']>(() => Effect.void);
  const detach = vi.fn<() => LiveDocument['detach']>(() => Effect.void);

  const liveDocument: Pick<
    LiveDocument,
    'content' | 'applyPendingLocalEdits' | 'attachTo' | 'detach'
  > = {
    content,
    applyPendingLocalEdits: Effect.suspend(applyPendingLocalEdits),
    attachTo,
    detach: Effect.suspend(detach),
  };

  return { liveDocument, applyPendingLocalEdits, attachTo, detach };
};

// Fake timers for the rest of the running test, restored when it finishes.
// `vi.runAllTimersAsync()` then lets everything that can still run finish.
export const useFakeTimersInTest = () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
};

// A promise the test settles itself, like Promise.withResolvers.
// TODO: use Promise.withResolvers once tsconfig's lib includes ES2024.
export const promiseWithResolvers = <A>() => {
  let resolve: (value: A) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<A>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return { promise, resolve, reject };
};
