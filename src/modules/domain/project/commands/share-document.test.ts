import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { NotFoundError } from '../errors';
import { parseProjectId } from '../models';
import { shareDocument, type ShareDocumentDeps } from './share-document';

const projectId = parseProjectId('/tmp/v2-share-document-test');
// `findDocumentById` is mocked, so the id's actual value is irrelevant.
const documentId = 'note.md' as unknown as ArtifactId;

const buildDeps = (
  overrides: Partial<ShareDocumentDeps> = {}
): ShareDocumentDeps => ({
  findDocumentById: vi.fn(() =>
    Effect.succeed({
      id: documentId,
      artifact: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content: 'on disk',
      },
    })
  ) as unknown as ShareDocumentDeps['findDocumentById'],
  shareDocument: vi.fn(() => Effect.succeed('automerge:share')),
  ...overrides,
});

describe('shareDocument', () => {
  it('shares the document as the store holds it', async () => {
    const deps = buildDeps();

    const shareUrl = await Effect.runPromise(
      shareDocument(deps)({ projectId, documentId })
    );

    expect(deps.shareDocument).toHaveBeenCalledWith({
      content: 'on disk',
    });
    expect(shareUrl).toBe('automerge:share');
  });

  it('shares nothing when the document cannot be read', async () => {
    const deps = buildDeps({
      findDocumentById: vi.fn(() =>
        Effect.fail(new NotFoundError('no such document'))
      ) as unknown as ShareDocumentDeps['findDocumentById'],
    });

    const failure = await Effect.runPromise(
      Effect.flip(shareDocument(deps)({ projectId, documentId }))
    );

    expect(failure).toBeInstanceOf(NotFoundError);
    expect(deps.shareDocument).not.toHaveBeenCalled();
  });
});
