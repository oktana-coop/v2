import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../models';
import {
  discardDocumentChanges,
  type DiscardDocumentChangesDeps,
} from './discard-document-changes';

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;

describe('discardDocumentChanges', () => {
  it('drops what is typed, discards, then re-reads the open document', async () => {
    const dropped = vi.fn<() => void>();
    const refreshed = vi.fn<() => void>();
    const discarded = vi.fn<() => void>();
    const discardUncommittedChanges = vi.fn<
      DiscardDocumentChangesDeps['discardUncommittedChanges']
    >(() => Effect.sync(discarded));

    await Effect.runPromise(
      discardDocumentChanges({ discardUncommittedChanges })({
        projectId,
        openDocument: {
          documentId,
          dropPendingLocalEdits: Effect.sync(dropped),
          refresh: Effect.sync(refreshed),
        },
      })
    );

    expect(discardUncommittedChanges).toHaveBeenCalledWith({
      projectId,
      documentId,
    });
    expect(dropped.mock.invocationCallOrder[0]).toBeLessThan(
      discarded.mock.invocationCallOrder[0]
    );
    expect(refreshed.mock.invocationCallOrder[0]).toBeGreaterThan(
      discarded.mock.invocationCallOrder[0]
    );
  });
});
