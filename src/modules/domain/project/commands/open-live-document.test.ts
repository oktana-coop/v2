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
import {
  openLiveDocument,
  type OpenLiveDocumentDeps,
} from './open-live-document';

const projectId = parseProjectId('/tmp/v2-live-document-test');
// `findDocumentById` is mocked, so the id's actual value is irrelevant.
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

const createMockProjectStore = (initialContent: string) => {
  let diskContent = initialContent;

  const findDocumentById = vi.fn(() =>
    Effect.succeed({ id: documentId, artifact: primaryDocument(diskContent) })
  );

  const updateRichTextDocumentContent = vi.fn(
    ({ content }: { content: string }) =>
      Effect.sync(() => {
        diskContent = content;
      })
  );

  return {
    findDocumentById,
    updateRichTextDocumentContent,
    writeToDisk: (content: string) => {
      diskContent = content;
    },
  };
};

const buildDeps = (
  mockStore: ReturnType<typeof createMockProjectStore>,
  overrides: Partial<OpenLiveDocumentDeps> = {}
): OpenLiveDocumentDeps => ({
  createLiveDocumentAdapter: createInMemoryLiveDocumentAdapter,
  transformToText: vi.fn(async ({ input }: { input: string }) =>
    transformed(input)
  ),
  findDocumentById: mockStore.findDocumentById,
  updateRichTextDocumentContent: mockStore.updateRichTextDocumentContent,
  onPersistError: vi.fn(),
  ...overrides,
});

const open = (deps: OpenLiveDocumentDeps) =>
  Effect.runPromise(openLiveDocument(deps)({ projectId, documentId }));

describe('openLiveDocument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens with the stored document and writes nothing', async () => {
    const mockStore = createMockProjectStore('on disk');

    const live = await open(buildDeps(mockStore));
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));

    expect(current).toEqual({
      doc: primaryDocument('on disk'),
      version: '0',
    });
    expect(mockStore.updateRichTextDocumentContent).not.toHaveBeenCalled();
  });

  it('updates live content immediately and writes behind after the debounce', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('typed')));

    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current).toEqual({ doc: editorDocument('typed'), version: '1' });
    expect(mockStore.updateRichTextDocumentContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    expect(mockStore.updateRichTextDocumentContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledWith({
      projectId,
      documentId,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: transformed('typed'),
    });
  });

  it('coalesces a burst of changes into one write of the last document', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('a')));
    await vi.advanceTimersByTimeAsync(100);
    await Effect.runPromise(live.change(editorDocument('ab')));
    await vi.advanceTimersByTimeAsync(100);
    await Effect.runPromise(live.change(editorDocument('abc')));

    await vi.advanceTimersByTimeAsync(300);

    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({ content: transformed('abc') })
    );
  });

  it('flushes without waiting for the timer and is idempotent', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.flush);

    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({ content: transformed('typed') })
    );

    await Effect.runPromise(live.flush);
    await vi.advanceTimersByTimeAsync(300);

    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
  });

  it('never writes a change the refresh superseded', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    mockStore.writeToDisk('restored from history');
    await Effect.runPromise(live.refresh);

    await vi.advanceTimersByTimeAsync(300);

    expect(mockStore.updateRichTextDocumentContent).not.toHaveBeenCalled();
    const current = await Effect.runPromise(SubscriptionRef.get(live.content));
    expect(current.doc).toEqual(primaryDocument('restored from history'));
  });

  it('produces no new value when a refresh re-reads what was last persisted', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    const received: LiveDocumentChange[] = [];
    const unsubscribe = subscribeToRef(live.content, (change) =>
      received.push(change)
    );
    // The replayed current value proves the subscription is live.
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await Effect.runPromise(live.refresh);

    // Sentinel: deliveries are ordered, so had the refresh produced a new
    // value, it would occupy the second slot instead of the sentinel.
    await Effect.runPromise(live.change(editorDocument('sentinel')));
    await vi.waitFor(() => expect(received).toHaveLength(2));

    expect(received).toEqual([
      { doc: primaryDocument('on disk'), version: '0' },
      { doc: editorDocument('sentinel'), version: '1' },
    ]);

    unsubscribe();
  });

  it('drops an armed write on cancelPendingPersist', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.cancelPendingPersist);

    await vi.advanceTimersByTimeAsync(300);

    expect(mockStore.updateRichTextDocumentContent).not.toHaveBeenCalled();
  });

  it('flushes pending work on close', async () => {
    const mockStore = createMockProjectStore('on disk');
    const live = await open(buildDeps(mockStore));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await Effect.runPromise(live.close);

    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({ content: transformed('typed') })
    );
  });

  it('reports a failing write through onPersistError', async () => {
    const mockStore = createMockProjectStore('on disk');
    const onPersistError = vi.fn();
    mockStore.updateRichTextDocumentContent.mockReturnValue(
      Effect.fail(new RepositoryError('write failed')) as never
    );

    const live = await open(buildDeps(mockStore, { onPersistError }));

    await Effect.runPromise(live.change(editorDocument('typed')));
    await vi.advanceTimersByTimeAsync(300);

    expect(onPersistError).toHaveBeenCalledTimes(1);
    expect(mockStore.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
  });
});
