import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  parseCommitId,
} from '../../../../modules/infrastructure/version-control';
import {
  PendingEditsNotSavedErrorTag,
  RepositoryError,
  VersionedProjectRepositoryErrorTag,
} from '../errors';
import { type ProjectId } from '../models';
import { commitDocument, type CommitDocumentDeps } from './commit-document';

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;
const commitId = parseCommitId('1111111111111111111111111111111111111111');

const setUp = ({ flushFails = false }: { flushFails?: boolean } = {}) => {
  const flushed = vi.fn<() => void>();
  const committed = vi.fn<() => void>();

  const openDocument = {
    documentId,
    flush: flushFails
      ? Effect.fail(new RepositoryError('the store refused the write'))
      : Effect.sync(flushed),
  };

  const commitDocumentChanges = vi.fn<
    CommitDocumentDeps['commitDocumentChanges']
  >(() =>
    Effect.sync(() => {
      committed();
      return { commitId, skippedAssetPaths: [] };
    })
  );

  const commit = commitDocument({ commitDocumentChanges })({
    projectId,
    openDocument,
    message: 'Second draft',
  });

  return { commit, commitDocumentChanges, flushed, committed };
};

describe('commitDocument', () => {
  it('commits the open document after saving what is typed in it', async () => {
    const { commit, commitDocumentChanges, flushed, committed } = setUp();

    const result = await Effect.runPromise(commit);

    expect(result.commitId).toBe(commitId);
    expect(commitDocumentChanges).toHaveBeenCalledWith({
      projectId,
      documentId,
      message: 'Second draft',
    });
    expect(flushed.mock.invocationCallOrder[0]).toBeLessThan(
      committed.mock.invocationCallOrder[0]
    );
  });

  it('commits nothing when what is typed cannot be saved', async () => {
    const { commit, committed } = setUp({ flushFails: true });

    const error = await Effect.runPromise(Effect.flip(commit));

    expect(error._tag).toBe(PendingEditsNotSavedErrorTag);
    expect(committed).not.toHaveBeenCalled();
  });

  it('fails with what the store fails with when the commit fails', async () => {
    const { commit, commitDocumentChanges } = setUp();
    commitDocumentChanges.mockReturnValueOnce(
      Effect.fail(new RepositoryError('the commit failed'))
    );

    const error = await Effect.runPromise(Effect.flip(commit));

    expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
  });
});
