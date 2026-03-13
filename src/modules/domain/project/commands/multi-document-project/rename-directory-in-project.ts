import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  AccessControlError as FilesystemAccessControlError,
  AlreadyExistsError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type RenameDirectoryInProjectArgs = {
  projectId: ProjectId;
  oldDirectoryPath: string;
  newDirectoryName: string;
  projectDirectoryPath: string;
};

export type RenameDirectoryInProjectDeps = {
  rename: Filesystem['rename'];
  renameDocumentsInProjectStore: MultiDocumentProjectStore['renameDocumentsInProject'];
  getAbsolutePath: Filesystem['getAbsolutePath'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  getRelativePath: Filesystem['getRelativePath'];
  getRenamedPath: Filesystem['getRenamedPath'];
};

export const renameDirectoryInProject =
  ({
    rename,
    renameDocumentsInProjectStore,
    getAbsolutePath,
    listDirectoryFiles,
    getRelativePath,
    getRenamedPath,
  }: RenameDirectoryInProjectDeps) =>
  ({
    projectId,
    oldDirectoryPath,
    newDirectoryName,
    projectDirectoryPath,
  }: RenameDirectoryInProjectArgs): Effect.Effect<
    { newDirectoryPath: string },
    | AlreadyExistsError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | RepositoryError
    | NotFoundError
    | ValidationError
    | MigrationError,
    never
  > =>
    pipe(
      getRenamedPath({ oldPath: oldDirectoryPath, newName: newDirectoryName }),
      Effect.flatMap((newDirectoryPath) =>
        pipe(
          Effect.all([
            getAbsolutePath({
              path: oldDirectoryPath,
              dirPath: projectDirectoryPath,
            }),
            getAbsolutePath({
              path: newDirectoryPath,
              dirPath: projectDirectoryPath,
            }),
          ]),
          Effect.flatMap(([absOldDir, absNewDir]) =>
            pipe(
              // List files before renaming so we can build the rename pairs
              listDirectoryFiles({ path: absOldDir, recursive: true }),
              Effect.flatMap((files) =>
                pipe(
                  // Get relative paths for all files (relative to project root)
                  Effect.forEach(files, (file) =>
                    getRelativePath({
                      path: file.path,
                      relativeTo: projectDirectoryPath,
                    })
                  ),
                  Effect.flatMap((oldDocumentPaths) =>
                    pipe(
                      rename({ oldPath: absOldDir, newPath: absNewDir }),
                      Effect.flatMap(() => {
                        const documentRenames = oldDocumentPaths.map(
                          (oldDocumentPath) => ({
                            oldDocumentPath,
                            // Replace old directory prefix with new directory path
                            newDocumentPath:
                              newDirectoryPath +
                              oldDocumentPath.slice(oldDirectoryPath.length),
                          })
                        );

                        if (documentRenames.length === 0) {
                          return Effect.void;
                        }

                        return renameDocumentsInProjectStore({
                          projectId,
                          documentRenames,
                        });
                      })
                    )
                  )
                )
              )
            )
          ),
          Effect.map(() => ({ newDirectoryPath }))
        )
      )
    );
