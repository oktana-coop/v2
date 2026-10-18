import * as Effect from 'effect/Effect';

import { createGitBlobRef } from '../../../../modules/infrastructure/version-control';
import { VersionedProjectValidationErrorTag } from '../errors';
import { parseProjectId, parseProjectRelPath } from '../models';
import {
  createDocumentInProject,
  type CreateDocumentInProjectDeps,
} from './create-document-in-project';

const projectId = parseProjectId('/tmp/v2-test-project');
const documentId = createGitBlobRef({
  ref: 'main',
  path: 'drafts/2026/config.yaml',
});

const createDocument = vi.fn<CreateDocumentInProjectDeps['createDocument']>(
  () => Effect.succeed(documentId)
);
const create = createDocumentInProject({ createDocument });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createDocumentInProject', () => {
  it('creates the document in the parent directory', async () => {
    const parentDirectoryPath = parseProjectRelPath('drafts/2026');

    const created = await Effect.runPromise(
      create({ projectId, parentDirectoryPath, name: 'config.yaml' })
    );

    expect(createDocument).toHaveBeenCalledWith({
      projectId,
      parentDirectoryPath,
      name: 'config.yaml',
    });
    expect(created).toBe(documentId);
  });

  it('refuses an invalid name without creating a document', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        create({ projectId, parentDirectoryPath: undefined, name: 'notes?.md' })
      )
    );

    expect(error._tag).toBe(VersionedProjectValidationErrorTag);
    expect(error.message).toMatch(/cannot contain/);
    expect(createDocument).not.toHaveBeenCalled();
  });
});
