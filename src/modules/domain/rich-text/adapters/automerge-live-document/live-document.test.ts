// The full build initializes the WebAssembly the slim build (used by the code
// under test) needs. In the app that is `createAutomergeRepo`'s job.
import '@automerge/automerge';

import * as Automerge from '@automerge/automerge/slim';
import { Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../errors';
import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import { type LiveDocument } from '../../ports/live-document';
import { createLiveDocument } from './live-document';
import { SHARE_FORMAT_VERSION, type SharedContent } from './shared-content';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// What the editor contributes: ProseMirror content that has to be converted
// on its way in; `pm:` marks what went through the conversion.
const editorDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content,
});

const transformToText = vi.fn(async ({ input }: { input: string }) =>
  input.replace(/^pm:/, '')
);

const seed = (content: string): SharedContent => ({
  shareFormatVersion: SHARE_FORMAT_VERSION,
  content,
});

const open = async (initialText: string) => {
  const repo = new Repo({ network: [] });
  const handle = repo.create<SharedContent>(seed(initialText));
  const onError = vi.fn();

  const live = await Effect.runPromise(
    createLiveDocument({
      handle,
      // One repo plays both parts: what this app keeps to itself and what it
      // shares are the same store here.
      privateRepo: Effect.succeed(repo),
      syncedRepo: Effect.succeed(repo),
      transformToText,
      onError,
    })
  );

  return { repo, handle, live, onError };
};

const versionOf = (live: LiveDocument) =>
  Effect.runPromise(SubscriptionRef.get(live.content)).then(
    (change) => change.version
  );

const textOf = (handle: { doc: () => SharedContent }) => handle.doc().content;

describe('automerge live document', () => {
  it('publishes the canonical content', async () => {
    const { live } = await open('hello');

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello');
    expect(current.doc.representation).toBe(PRIMARY_RICH_TEXT_REPRESENTATION);
  });

  it('converts and applies a contribution', async () => {
    const { live, handle } = await open('hello');

    await Effect.runPromise(live.change(editorDocument('pm:hello world')));

    expect(textOf(handle)).toBe('hello world');
  });

  it('publishes the contribution before resolving', async () => {
    const { live } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello world');
  });

  // Contributions can outpace their conversions, so several may share a base
  // while each extends the last. Anchoring them all at that shared base
  // would re-apply the overlap as concurrent inserts.
  it('chains contributions sharing a base instead of re-applying their overlap', async () => {
    const { live, handle } = await open('note');
    const base = await versionOf(live);

    await Effect.runPromise(live.change(markdown('note one'), { base }));
    await Effect.runPromise(live.change(markdown('note one two'), { base }));
    await Effect.runPromise(
      live.change(markdown('note one two three'), { base })
    );

    expect(textOf(handle)).toBe('note one two three');
  });

  it('keeps a peer edit the contribution had not seen', async () => {
    const { live, handle } = await open('one two three');
    const base = await versionOf(live);

    // Arrives after the contribution below was derived, as a peer's edit
    // would.
    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'one two three PEER')
    );

    await Effect.runPromise(
      live.change(markdown('one two three LOCAL'), { base })
    );

    expect(textOf(handle)).toContain('PEER');
    expect(textOf(handle)).toContain('LOCAL');
  });

  it('publishes a change made to the document by anyone else', async () => {
    const { live, handle } = await open('hello');

    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'from a peer')
    );

    await vi.waitFor(async () => {
      const current = await Effect.runPromise(
        SubscriptionRef.get(live.content)
      );
      expect(current.doc.content).toBe('from a peer');
    });
  });

  it('publishes nothing when a change leaves the text as it was', async () => {
    const { live, handle } = await open('hello');
    const versionBefore = await versionOf(live);

    handle.change((doc) => Automerge.updateText(doc, ['content'], 'hello'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await versionOf(live)).toBe(versionBefore);
  });

  it('stops publishing once closed', async () => {
    const { live, handle } = await open('hello');

    await Effect.runPromise(live.close);
    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'after closing')
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello');
  });

  it('continues on the document at an address after attaching', async () => {
    const { live, repo, handle } = await open('hello');
    const shared = repo.create<SharedContent>(seed('hello'));

    await Effect.runPromise(live.attachTo(shared.url));

    const base = await versionOf(live);
    await Effect.runPromise(live.change(markdown('hello there'), { base }));

    expect(textOf(shared)).toBe('hello there');
    expect(textOf(handle)).toBe('hello');
  });

  it('continues on a document of its own after detaching, keeping the content', async () => {
    const { live, repo, handle } = await open('hello');
    const shared = repo.create<SharedContent>(seed('hello'));
    await Effect.runPromise(live.attachTo(shared.url));
    await Effect.runPromise(live.change(markdown('hello shared')));

    await Effect.runPromise(live.detach);

    const base = await versionOf(live);
    await Effect.runPromise(live.change(markdown('hello on my own'), { base }));

    // The peers keep what they had; this document went its own way.
    expect(textOf(shared)).toBe('hello shared');
    expect(textOf(handle)).toBe('hello');
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello on my own');
  });

  it('refuses an address that is not a shared document link', async () => {
    const { live } = await open('hello');

    const failure = await Effect.runPromise(
      Effect.flip(live.attachTo('not-a-link'))
    );

    expect(failure).toBeInstanceOf(ValidationError);
  });

  it('drops a contribution anchored before a switch', async () => {
    const { live, repo, onError } = await open('hello');
    const staleBase = await versionOf(live);
    const shared = repo.create<SharedContent>(seed('hello'));

    await Effect.runPromise(live.attachTo(shared.url));
    // Force the anchored path: the new document has moved past its opening
    // state, so the stale base cannot be current.
    shared.change((doc) =>
      Automerge.updateText(doc, ['content'], 'hello moved')
    );

    await Effect.runPromise(
      live.change(markdown('derived from the old document'), {
        base: staleBase,
      })
    );

    expect(textOf(shared)).toBe('hello moved');
    expect(onError).toHaveBeenCalled();
  });
});
