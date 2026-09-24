import * as Automerge from '@automerge/automerge';
import { type DocHandle, Repo } from '@automerge/automerge-repo';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { subscribeToStream } from '../../../../../utils/effect';
import { PRIMARY_RICH_TEXT_REPRESENTATION } from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentError,
} from '../../ports/convergent-document';
import { createConvergentDocument } from './convergent-document';
import {
  DOCUMENT_FORMAT_VERSION,
  type DocumentContent,
} from './document-content';
import { createNullPresence } from './presence';

const seed = (content: string): DocumentContent => ({
  formatVersion: DOCUMENT_FORMAT_VERSION,
  content,
});

const open = async (initialText: string) => {
  const repo = new Repo({ network: [] });
  const handle = repo.create<DocumentContent>(seed(initialText));

  const presence = await Effect.runPromise(createNullPresence());
  const live = await Effect.runPromise(
    createConvergentDocument({ handle, presence })
  );

  const reported: ConvergentDocumentError[] = [];
  subscribeToStream(live.errors, (error) => {
    reported.push(error);
  });

  return { repo, handle, live, reported };
};

const versionOf = (live: ConvergentDocument) =>
  Effect.runPromise(SubscriptionRef.get(live.content)).then(
    (change) => change.version
  );

const textOf = (handle: DocHandle<DocumentContent>) => handle.fullDoc().content;

describe('automerge live document', () => {
  it('publishes the canonical content', async () => {
    const { live } = await open('hello');

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello');
    expect(current.doc.representation).toBe(PRIMARY_RICH_TEXT_REPRESENTATION);
  });

  it('applies a contribution', async () => {
    const { live, handle } = await open('hello');

    await Effect.runPromise(live.change('hello world'));

    expect(textOf(handle)).toBe('hello world');
  });

  it('publishes the contribution before resolving', async () => {
    const { live } = await open('hello');

    await Effect.runPromise(live.change('hello world'));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello world');
  });

  // Two sources can derive from one base without either extending the
  // other, the disk and the editor say. A contribution is applied at the base
  // it names, whatever came before it.
  it('merges contributions sharing a base rather than replacing one with the other', async () => {
    const { live, handle } = await open('hello');
    const base = await versionOf(live);

    await Effect.runPromise(live.change('hello DISK', { base }));
    await Effect.runPromise(live.change('hello LOCAL', { base }));

    expect(textOf(handle)).toContain('DISK');
    expect(textOf(handle)).toContain('LOCAL');
  });

  it('keeps a peer edit the contribution had not seen', async () => {
    const { live, handle } = await open('one two three');
    const base = await versionOf(live);

    // Arrives after the contribution below was derived, as a peer's edit
    // would.
    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'one two three PEER')
    );

    await Effect.runPromise(live.change('one two three LOCAL', { base }));

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

  it('drops a contribution anchored at a version it never had', async () => {
    const { live, handle, reported } = await open('hello');
    // A version from some other document: the anchor cannot resolve here,
    // and applying it as a whole-document diff would delete text this
    // contribution never saw.
    const elsewhere = new Repo({ network: [] }).create<DocumentContent>(
      seed('hello elsewhere')
    );
    const foreignBase = [...elsewhere.heads()].sort().join(',');
    // Move past the opening state, so the foreign base cannot be current.
    handle.change((doc) => Automerge.updateText(doc, ['content'], 'hello you'));

    await Effect.runPromise(
      live.change('derived from another document', { base: foreignBase })
    );

    expect(textOf(handle)).toBe('hello you');
    await vi.waitFor(() => expect(reported).not.toHaveLength(0));
  });
});
