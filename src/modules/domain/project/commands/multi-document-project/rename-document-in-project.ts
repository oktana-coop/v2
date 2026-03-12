import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  AccessControlError as FilesystemAccessControlError,
  AlreadyExistsError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type RenameDocumentInProjectArgs = {
  projectId: ProjectId;
  oldDocumentPath: string;
  newName: string;
  renameInFilesystem?: boolean;
  projectDirectoryPath: string;
};

export type RenameDocumentInProjectDeps = {
  renameFile: Filesystem['renameFile'];
  renameDocumentInProjectStore: MultiDocumentProjectStore['renameDocumentInProject'];
  getAbsolutePath: Filesystem['getAbsolutePath'];
  getRenamedPath: Filesystem['getRenamedPath'];
};

export const renameDocumentInProject =
  ({
    renameFile,
    renameDocumentInProjectStore,
    getAbsolutePath,
    getRenamedPath,
  }: RenameDocumentInProjectDeps) =>
  ({
    projectId,
    oldDocumentPath,
    newName,
    renameInFilesystem,
    projectDirectoryPath,
  }: RenameDocumentInProjectArgs): Effect.Effect<
    { newDocumentPath: string },
    | AlreadyExistsError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
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
          renameInFilesystem
            ? pipe(
                Effect.all([
                  getAbsolutePath({
                    path: oldDocumentPath,
                    dirPath: projectDirectoryPath,
                  }),
                  getAbsolutePath({
                    path: newDocumentPath,
                    dirPath: projectDirectoryPath,
                  }),
                ]),
                Effect.flatMap(([oldAbsolutePath, newAbsolutePath]) =>
                  renameFile({
                    oldPath: oldAbsolutePath,
                    newPath: newAbsolutePath,
                  })
                )
              )
            : Effect.succeed(undefined),
          Effect.flatMap(() =>
            renameDocumentInProjectStore({
              projectId,
              oldDocumentPath,
              newDocumentPath,
            })
          ),
          Effect.map(() => ({ newDocumentPath }))
        )
      )
    );
