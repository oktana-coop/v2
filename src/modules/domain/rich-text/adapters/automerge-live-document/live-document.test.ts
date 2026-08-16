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
import {
  type AutomergeLiveDocument,
  createLiveDocument,
} from './live-document';
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

// A live document over one canonical handle, with the disk faked as a plain
// variable the tests can edit like another program would.
const open = async (initialText: string) => {
  const repo = new Repo({ network: [] });
  const handle = repo.create<SharedContent>(seed(initialText));
  const onError = vi.fn();

  const written: string[] = [];
  let diskText = initialText;
  let diskListener: (() => void) | undefined;
  let readsFailing = 0;
  let writesFailing = 0;
  let documentGone = false;

  const live = await Effect.runPromise(
    createLiveDocument({
      handle,
      // One repo plays both parts: what this app keeps to itself and what it
      // shares are the same store here.
      privateRepo: Effect.succeed(repo),
      syncedRepo: Effect.succeed(repo),
      initialText,
      readDocument: Effect.suspend(() => {
        if (readsFailing-- > 0) return Effect.fail(new Error('read failed'));

        // Null is how the store reports a document that is gone.
        return Effect.succeed(documentGone ? null : markdown(diskText));
      }),
      writeDocument: (doc) =>
        Effect.suspend(() =>
          writesFailing-- > 0
            ? Effect.fail(new Error('write failed'))
            : Effect.sync(() => {
                written.push(doc.content);
                diskText = doc.content;
                return doc.content;
              })
        ),
      subscribeToDocumentChanges: (listener) => {
        diskListener = listener;
        return () => {
          diskListener = undefined;
        };
      },
      transformToText,
      onError,
    })
  );

  return {
    repo,
    handle,
    live,
    written,
    onError,
    // An edit made by another hand, signalled like the watcher would.
    editDisk: (text: string) => {
      diskText = text;
      diskListener?.();
    },
    failNextRead: () => {
      readsFailing = 1;
    },
    failNextWrite: () => {
      writesFailing = 1;
    },
    loseDocument: () => {
      documentGone = true;
      diskListener?.();
    },
  };
};

const versionOf = (live: Pick<AutomergeLiveDocument, 'content'>) =>
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

  it('converts and applies an editor contribution', async () => {
    const { live, handle } = await open('hello');

    await Effect.runPromise(live.change(editorDocument('pm:hello world')));

    expect(textOf(handle)).toBe('hello world');
  });

  // While the editor's absorbed state lags, every keystroke contributes the
  // full text with the same base, each extending the last. Anchoring them
  // all at that shared base would re-apply the overlap as concurrent
  // inserts; the intake anchors each at the previous contribution instead.
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

  it('persists new content to disk after the debounce', async () => {
    const { live, written } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));

    await vi.waitFor(() => expect(written).toContain('hello world'));
  });

  it('flushes pending content on close', async () => {
    const { live, written } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));
    await Effect.runPromise(live.close);

    expect(written).toContain('hello world');
  });

  it('does not persist content marked as cancelled', async () => {
    const { live, written } = await open('hello');

    await Effect.runPromise(live.change(markdown('restored old state')));
    await Effect.runPromise(live.cancelPendingPersist);
    await Effect.runPromise(live.flush);

    expect(written).toEqual([]);
  });

  it('ignores the echo of its own write coming back from the watcher', async () => {
    const { live, handle, editDisk, written } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));
    await Effect.runPromise(live.flush);
    const headsBefore = handle.heads();

    // The watcher reports our own write.
    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(handle.heads()).toEqual(headsBefore);
    expect(written).toHaveLength(1);
  });

  it('merges an external disk edit with text it had not seen', async () => {
    const { live, handle, editDisk } = await open('hello');

    // Typed but not yet persisted: the disk still holds the opening text.
    await Effect.runPromise(live.change(markdown('hello TYPED')));

    editDisk('hello EXTERNAL');

    await vi.waitFor(() => {
      expect(textOf(handle)).toContain('TYPED');
      expect(textOf(handle)).toContain('EXTERNAL');
    });
  });

  it('publishes the contribution before resolving', async () => {
    const { live } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('hello world');
  });

  it('opens with the stored document and writes nothing', async () => {
    const { written } = await open('hello');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(written).toEqual([]);
  });

  it('coalesces a burst of changes into one write of the last content', async () => {
    const { live, written } = await open('hello');

    for (const text of ['a', 'ab', 'abc']) {
      await Effect.runPromise(live.change(markdown(text)));
    }
    await Effect.runPromise(live.flush);

    expect(written).toEqual(['abc']);
  });

  it('flushes idempotently', async () => {
    const { live, written } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));
    await Effect.runPromise(live.flush);
    await Effect.runPromise(live.flush);

    expect(written).toEqual(['hello world']);
  });

  it('picks up a change made outside the app', async () => {
    const { live, handle, editDisk } = await open('hello');

    editDisk('changed outside');

    await vi.waitFor(() => expect(textOf(handle)).toBe('changed outside'));
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc.content).toBe('changed outside');
  });

  it('keeps typing that arrives while its own write echoes back', async () => {
    const { live, handle, editDisk } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello world')));
    await Effect.runPromise(live.flush);
    // Typed after the write, before the watcher reports it.
    await Effect.runPromise(live.change(markdown('hello world!')));

    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(textOf(handle)).toBe('hello world!');
  });

  it('persists a change that reaches the document without going through change', async () => {
    const { handle, written } = await open('hello');

    handle.change((doc) =>
      Automerge.updateText(doc, ['content'], 'from a peer')
    );

    await vi.waitFor(() => expect(written).toContain('from a peer'));
  });

  // A rename takes the document out from under the watcher: there is
  // nothing to pick up, and nothing worth reporting either.
  it('keeps working, silently, when the document is gone', async () => {
    const { live, handle, loseDocument, onError } = await open('hello');

    await Effect.runPromise(live.change(markdown('hello typed')));
    loseDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(textOf(handle)).toBe('hello typed');
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the document open when reading the disk fails', async () => {
    const { live, handle, editDisk, failNextRead, onError } =
      await open('hello');

    failNextRead();
    editDisk('never seen');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(textOf(handle)).toBe('hello');
    expect(onError).toHaveBeenCalled();
    // The document keeps working afterwards.
    await Effect.runPromise(live.change(markdown('still alive')));
    expect(textOf(handle)).toBe('still alive');
  });

  it('reports a failing write and keeps the document open', async () => {
    const { live, handle, failNextWrite, onError } = await open('hello');

    failNextWrite();
    await Effect.runPromise(live.change(markdown('hello world')));
    await Effect.runPromise(live.flush);

    expect(onError).toHaveBeenCalled();
    expect(textOf(handle)).toBe('hello world');
  });

  it('stops following the disk on close', async () => {
    const { live, handle, editDisk } = await open('hello');

    await Effect.runPromise(live.close);
    editDisk('after closing');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(textOf(handle)).toBe('hello');
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
