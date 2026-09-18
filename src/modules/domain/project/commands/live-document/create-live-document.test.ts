import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RemotePresence,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { createLiveDocument } from './create-live-document';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// Content in the editor's representation, which reaches the document
// converted: `pm:` marks what the conversion strips.
const proseMirror = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content: `pm:${content}`,
});

const documentId = '/blob/main/note.md' as ArtifactId;

// A convergent document holding text, versioned by a counter, that records
// what was contributed to it and with which base.
const createFakeConvergentDocument = async (initialText: string) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdown(initialText),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );
  const contributions: Array<{ text: string; base?: string }> = [];
  let versions = 0;
  let closed = false;

  const document: ConvergentDocument = {
    content,
    presence: { peers, publish: () => Effect.void },
    change: (text, options) => {
      contributions.push({ text, base: options?.base });
      versions += 1;
      const version = `v${versions}`;

      return pipe(
        SubscriptionRef.set(content, { doc: markdown(text), version }),
        Effect.as(version)
      );
    },
    errors: Stream.empty,
    close: Effect.sync(() => {
      closed = true;
    }),
  };

  return { document, contributions, wasClosed: () => closed };
};

// A live document with nothing behind it: no disk, no share.
const open = async (initialText = 'hello') => {
  const fake = await createFakeConvergentDocument(initialText);

  const opened = await Effect.runPromise(
    createLiveDocument({
      createPrivateDocument: (text) =>
        Effect.promise(
          async () => (await createFakeConvergentDocument(text)).document
        ),
      openSharedDocument: () => Effect.die('no share in these tests'),
      transformToText: async ({ input }: { input: string }) =>
        input.replace(/^pm:/, ''),
    })({ documentId, initialDocument: fake.document })
  );

  return { opened, ...fake };
};

// Types content and leaves it on its way, as typing that has not paused;
// `contributed` resolves with its version once it reaches the document.
const typeWithoutPausing = async (
  opened: Awaited<ReturnType<typeof open>>['opened'],
  doc: RichTextDocument
) => {
  const contributed = Effect.runPromise(opened.edit(doc));
  await Promise.resolve();
  return { contributed };
};

const currentContent = (opened: Awaited<ReturnType<typeof open>>['opened']) =>
  Effect.runPromise(SubscriptionRef.get(opened.content)).then(
    (current) => current.doc.content
  );

describe('createLiveDocument, with nothing behind it', () => {
  it('contributes pending typing on applyPendingLocalEdits, converted', async () => {
    const { opened, contributions } = await open();

    const { contributed } = await typeWithoutPausing(
      opened,
      proseMirror('hello typed')
    );
    await Effect.runPromise(opened.applyPendingLocalEdits);

    await contributed;
    expect(contributions).toEqual([{ text: 'hello typed', base: undefined }]);
    expect(await currentContent(opened)).toBe('hello typed');
  });

  it('drops pending typing on dropPendingLocalEdits', async () => {
    const { opened, contributions } = await open();

    const { contributed } = await typeWithoutPausing(
      opened,
      markdown('restored old state')
    );
    await Effect.runPromise(opened.dropPendingLocalEdits);
    await Effect.runPromise(opened.applyPendingLocalEdits);

    // Whoever waited for it is released, with the version the document holds.
    await expect(contributed).resolves.toBe('v0');
    expect(contributions).toEqual([]);
    expect(await currentContent(opened)).toBe('hello');
  });

  it('contributes pending typing when it closes, then closes the document it runs on', async () => {
    const { opened, contributions, wasClosed } = await open();

    const { contributed } = await typeWithoutPausing(
      opened,
      markdown('hello world')
    );
    await Effect.runPromise(opened.close);

    await contributed;
    expect(contributions.map((contribution) => contribution.text)).toEqual([
      'hello world',
    ]);
    expect(wasClosed()).toBe(true);
  });

  it('takes primary text as a change anchored at the base it derives from', async () => {
    const { opened, contributions } = await open();

    const version = await Effect.runPromise(
      opened.change('hello from elsewhere', { base: 'v0' })
    );

    expect(version).toBe('v1');
    expect(contributions).toEqual([
      { text: 'hello from elsewhere', base: 'v0' },
    ]);
    expect(await currentContent(opened)).toBe('hello from elsewhere');
  });
});
