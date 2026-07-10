import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  AlreadyExistsError,
  type Filesystem,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';

export type RenameDocumentInProjectArgs = {
  projectId: ProjectId;
  oldDocumentPath: string;
  newName: string;
};

export type RenameDocumentInProjectDeps = {
  renameDocumentInProjectStore: ProjectStore['renameDocumentInProject'];
  getRenamedPath: Filesystem['getRenamedPath'];
};

export const renameDocumentInProject =
  ({
    renameDocumentInProjectStore,
    getRenamedPath,
  }: RenameDocumentInProjectDeps) =>
  ({
    projectId,
    oldDocumentPath,
    newName,
  }: RenameDocumentInProjectArgs): Effect.Effect<
    { newDocumentPath: string },
    | AlreadyExistsError
    | FilesystemRepositoryError
    | RepositoryError
    | NotFoundError
    | ValidationError
    | MigrationError,
    never
  > =>
    pipe(
      getRenamedPath({ oldPath: oldDocumentPath, newName }),
      Effect.flatMap((newDocumentPath) =>
        pipe(
          renameDocumentInProjectStore({
            projectId,
            oldDocumentPath,
            newDocumentPath,
          }),
          Effect.map(() => ({ newDocumentPath }))
        )
      )
    );
