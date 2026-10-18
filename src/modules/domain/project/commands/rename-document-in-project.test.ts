import * as Effect from 'effect/Effect';

import { VersionedProjectValidationErrorTag } from '../errors';
import { parseProjectId } from '../models';
import {
  renameDocumentInProject,
  type RenameDocumentInProjectDeps,
} from './rename-document-in-project';

const projectId = parseProjectId('/tmp/v2-test-project');

const renameDocumentInProjectStore = vi.fn<
  RenameDocumentInProjectDeps['renameDocumentInProjectStore']
>(() => Effect.void);
const getRenamedPath = vi.fn<RenameDocumentInProjectDeps['getRenamedPath']>(
  () => Effect.succeed('drafts/notes.yaml')
);
const rename = renameDocumentInProject({
  renameDocumentInProjectStore,
  getRenamedPath,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renameDocumentInProject', () => {
  it('renames the document to the path built from the full name it is given', async () => {
    const renamed = await Effect.runPromise(
      rename({
        projectId,
        oldDocumentPath: 'drafts/notes.md',
        newName: 'notes.yaml',
      })
    );

    expect(getRenamedPath).toHaveBeenCalledWith({
      oldPath: 'drafts/notes.md',
      newName: 'notes.yaml',
    });
    expect(renameDocumentInProjectStore).toHaveBeenCalledWith({
      projectId,
      oldDocumentPath: 'drafts/notes.md',
      newDocumentPath: 'drafts/notes.yaml',
    });
    expect(renamed).toEqual({ newDocumentPath: 'drafts/notes.yaml' });
  });

  it('refuses an invalid name without renaming', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        rename({ projectId, oldDocumentPath: 'notes.md', newName: 'notes?.md' })
      )
    );

    expect(error._tag).toBe(VersionedProjectValidationErrorTag);
    expect(error.message).toMatch(/cannot contain/);
    expect(renameDocumentInProjectStore).not.toHaveBeenCalled();
  });
});
