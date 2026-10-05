import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  parseCommitId,
  type UncommitedChange,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../models';
import { type GetDocumentHistoryResponse, type ProjectStore } from '../ports';
import { getDocumentVersioningState } from './get-document-versioning-state';

const projectId = '/projects/one' as ProjectId;
const documentId = 'notes.md' as ArtifactId;

const firstCommit = {
  id: parseCommitId('1111111111111111111111111111111111111111'),
  message: 'First draft',
  time: new Date('2026-10-01T10:00:00Z'),
};

const uncommittedChange: UncommitedChange = { id: UNCOMMITTED_CHANGE_ID };

const committedHistory: GetDocumentHistoryResponse = {
  history: [firstCommit],
  current: { schemaVersion: 1, representation: 'MARKDOWN', content: 'Hello' },
  latestChange: firstCommit,
  lastCommit: firstCommit,
  hasUncommittedChanges: false,
};

const modifiedHistory: GetDocumentHistoryResponse = {
  ...committedHistory,
  history: [uncommittedChange, firstCommit],
  latestChange: uncommittedChange,
  hasUncommittedChanges: true,
};

const neverCommittedHistory = (
  content: string
): GetDocumentHistoryResponse => ({
  history: [uncommittedChange],
  current: { schemaVersion: 1, representation: 'MARKDOWN', content },
  latestChange: uncommittedChange,
  lastCommit: null,
  hasUncommittedChanges: true,
});

const setUp = ({
  history,
  isContentSame = false,
}: {
  history: GetDocumentHistoryResponse;
  isContentSame?: boolean;
}) => {
  const getDocumentHistory = vi.fn<ProjectStore['getDocumentHistory']>(() =>
    Effect.succeed(history)
  );
  const isContentSameAtChanges = vi.fn<ProjectStore['isContentSameAtChanges']>(
    () => Effect.succeed(isContentSame)
  );

  const getState = getDocumentVersioningState({
    getDocumentHistory,
    isContentSameAtChanges,
  })({ projectId, documentId });

  return { getState, getDocumentHistory, isContentSameAtChanges };
};

describe('getDocumentVersioningState', () => {
  it('resolves to the document history', async () => {
    const { getState, getDocumentHistory } = setUp({
      history: modifiedHistory,
    });

    const state = await Effect.runPromise(getState);

    expect(state.history).toEqual([uncommittedChange, firstCommit]);
    expect(getDocumentHistory).toHaveBeenCalledWith({ projectId, documentId });
  });

  it('cannot commit when the latest change is the last commit', async () => {
    const { getState, isContentSameAtChanges } = setUp({
      history: committedHistory,
    });

    const state = await Effect.runPromise(getState);

    expect(state.canCommit).toBe(false);
    expect(isContentSameAtChanges).not.toHaveBeenCalled();
  });

  it('can commit when the uncommitted content differs from the last commit', async () => {
    const { getState, isContentSameAtChanges } = setUp({
      history: modifiedHistory,
      isContentSame: false,
    });

    const state = await Effect.runPromise(getState);

    expect(state.canCommit).toBe(true);
    expect(isContentSameAtChanges).toHaveBeenCalledWith({
      projectId,
      documentId,
      change1: UNCOMMITTED_CHANGE_ID,
      change2: firstCommit.id,
    });
  });

  it('cannot commit when the uncommitted content equals the last commit', async () => {
    const { getState } = setUp({
      history: modifiedHistory,
      isContentSame: true,
    });

    const state = await Effect.runPromise(getState);

    expect(state.canCommit).toBe(false);
  });

  it('can commit a never-committed document that has content', async () => {
    const { getState } = setUp({ history: neverCommittedHistory('Hello') });

    const state = await Effect.runPromise(getState);

    expect(state.canCommit).toBe(true);
  });

  it('cannot commit a never-committed document that is empty', async () => {
    const { getState } = setUp({ history: neverCommittedHistory('') });

    const state = await Effect.runPromise(getState);

    expect(state.canCommit).toBe(false);
  });

  it('reads the history again on every run', async () => {
    const { getState, getDocumentHistory } = setUp({
      history: committedHistory,
    });

    await Effect.runPromise(getState);
    await Effect.runPromise(getState);

    expect(getDocumentHistory).toHaveBeenCalledTimes(2);
  });
});
