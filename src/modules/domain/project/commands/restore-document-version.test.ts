import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  parseCommitId,
} from '../../../../modules/infrastructure/version-control';
import { PendingEditsNotSavedErrorTag, RepositoryError } from '../errors';
import { type ProjectId } from '../models';
import {
  restoreDocumentVersion,
  type RestoreDocumentVersionDeps,
} from './restore-document-version';

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;

const firstCommit = {
  id: parseCommitId('1111111111111111111111111111111111111111'),
  message: 'First draft',
  time: new Date('2026-10-01T10:00:00Z'),
};
const restoreCommitId = parseCommitId(
  '2222222222222222222222222222222222222222'
);

const setUp = ({ flushFails = false }: { flushFails?: boolean } = {}) => {
  const flushed = vi.fn<() => void>();
  const refreshed = vi.fn<() => void>();
  const restored = vi.fn<() => void>();

  const openDocument = {
    documentId,
    flush: flushFails
      ? Effect.fail(new RepositoryError('the store refused the write'))
      : Effect.sync(flushed),
    refresh: Effect.sync(refreshed),
  };

  const restoreDocumentChanges = vi.fn<
    RestoreDocumentVersionDeps['restoreDocumentChanges']
  >(() =>
    Effect.sync(() => {
      restored();
      return { commitId: restoreCommitId, skippedAssetPaths: [] };
    })
  );

  const restore = restoreDocumentVersion({ restoreDocumentChanges })({
    projectId,
    openDocument,
    commit: firstCommit,
    message: 'Restore "First draft"',
  });

  return { restore, restoreDocumentChanges, flushed, refreshed, restored };
};

describe('restoreDocumentVersion', () => {
  it('saves what is typed, restores, then re-reads the open document', async () => {
    const { restore, restoreDocumentChanges, flushed, refreshed, restored } =
      setUp();

    const result = await Effect.runPromise(restore);

    expect(result.commitId).toBe(restoreCommitId);
    expect(restoreDocumentChanges).toHaveBeenCalledWith({
      projectId,
      documentId,
      commit: firstCommit,
      message: 'Restore "First draft"',
    });
    expect(flushed.mock.invocationCallOrder[0]).toBeLessThan(
      restored.mock.invocationCallOrder[0]
    );
    expect(refreshed.mock.invocationCallOrder[0]).toBeGreaterThan(
      restored.mock.invocationCallOrder[0]
    );
  });

  it('restores nothing when what is typed cannot be saved', async () => {
    const { restore, restored, refreshed } = setUp({ flushFails: true });

    const error = await Effect.runPromise(Effect.flip(restore));

    expect(error._tag).toBe(PendingEditsNotSavedErrorTag);
    expect(restored).not.toHaveBeenCalled();
    expect(refreshed).not.toHaveBeenCalled();
  });
});
