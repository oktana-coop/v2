import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  type LiveDocumentChange,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import { createAdapter as createInMemoryLiveDocumentAdapter } from '../../../../modules/domain/rich-text/adapters/in-memory-live-document';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { subscribeToRef } from '../../../../utils/effect';
import { RepositoryError } from '../errors';
import { parseProjectId } from '../models';
import { type ProjectStore } from '../ports';
import {
  openLiveDocument,
  type OpenLiveDocumentDeps,
} from './open-live-document';

const projectId = parseProjectId('/tmp/v2-live-document-test');
// `findDocumentById` is faked, so the id's actual value is irrelevant.
const documentId = 'note.md' as unknown as ArtifactId;

const primaryDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

// What the editor contributes: ProseMirror content that has to be transformed
// on its way to disk.
const editorDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content,
});

const transformed = (content: string) => `md:${content}`;

const createFakeProjectStore = (initialContent: string) => {
  let diskContent = initialContent;

  const findDocumentById = vi.fn(() =>
    Effect.succeed({ id: documentId, artifact: primaryDocument(diskContent) })
  );

  const writes: string[] = [];
  const updateRichTextDocumentContent = vi.fn(
    ({ content }: { content: string }) =>
      Effect.sync(() => {
        writes.push(content);
        diskContent = content;
      })
  );

  return {
    projectStore: {
      findDocumentById,
      updateRichTextDocumentContent,
    } as unknown as ProjectStore,
    writes,
    findDocumentById,
    updateRichTextDocumentContent,
    writeToDisk: (content: string) => {
      diskContent = content;
    },
  };
};

const buildDeps = (
  fakeStore: ReturnType<typeof createFakeProjectStore>,
  overrides: Partial<OpenLiveDocumentDeps> = {}
): OpenLiveDocumentDeps => ({
  createLiveDocumentAdapter: createInMemoryLiveDocumentAdapter,
  transformToText: vi.fn(async ({ input }: { input: string }) =>
    transformed(input)
  ),
  projectStore: fakeStore.projectStore,
  onPersistError: vi.fn(),
  ...overrides,
});

const open = (deps: OpenLiveDocumentDeps) =>
  Effect.runPromise(openLiveDocument(deps)({ projectId, documentId }));

// Effect schedules on microtasks and the debounce on a timer; drain both.
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('openLiveDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens with the stored document and writes nothing', async () => {
    const fakeStore = createFakeProjectStore('on disk');

    const live = await open(buildDeps(fakeStore));
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));

    expect(current).toEqual({
      doc: primaryDocument('on disk'),
      version: '0',
    });
    expect(fakeStore.writes).toEqual([]);
  });

  it('updates live content immediately and writes behind after the debounce', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('typed')));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current).toEqual({ doc: editorDocument('typed'), version: '1' });
    expect(fakeStore.writes).toEqual([]);

    await vi.advanceTimersByTimeAsync(299);
    expect(fakeStore.writes).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(fakeStore.writes).toEqual([transformed('typed')]);
    expect(fakeStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(fakeStore.updateRichTextDocumentContent).toHaveBeenCalledWith({
      projectId,
      documentId,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: transformed('typed'),
    });
  });

  it('coalesces a burst of changes into one write of the last document', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('a')));
    await vi.advanceTimersByTimeAsync(100);
    await Effect.runPromise(live.change(editorDocument('ab')));
    await vi.advanceTimersByTimeAsync(100);
    await Effect.runPromise(live.change(editorDocument('abc')));

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.writes).toEqual([transformed('abc')]);
  });

  it('flushes without waiting for the timer and is idempotent', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.flush);

    expect(fakeStore.writes).toEqual([transformed('typed')]);

    await Effect.runPromise(live.flush);
    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.writes).toEqual([transformed('typed')]);
  });

  it('never writes a change the refresh superseded', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    fakeStore.writeToDisk('restored from history');
    await Effect.runPromise(live.refresh);

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.writes).toEqual([]);
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc).toEqual(primaryDocument('restored from history'));
  });

  it('emits nothing when a refresh re-reads what was last persisted', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    const received: LiveDocumentChange[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    await settle();
    expect(received).toHaveLength(1);

    await Effect.runPromise(live.refresh);
    await settle();

    expect(received).toHaveLength(1);

    unsubscribe();
  });

  it('drops an armed write on cancelPendingPersist', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.cancelPendingPersist);

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.writes).toEqual([]);
  });

  it('flushes pending work on close', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const live = await open(buildDeps(fakeStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.close);

    expect(fakeStore.writes).toEqual([transformed('typed')]);
  });

  it('reports a failing write through onPersistError', async () => {
    const fakeStore = createFakeProjectStore('on disk');
    const onPersistError = vi.fn();
    fakeStore.updateRichTextDocumentContent.mockReturnValue(
      Effect.fail(new RepositoryError('write failed')) as never
    );

    const live = await open(buildDeps(fakeStore, { onPersistError }));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await vi.advanceTimersByTimeAsync(300);

    expect(onPersistError).toHaveBeenCalledTimes(1);
    expect(fakeStore.writes).toEqual([]);
  });
});
