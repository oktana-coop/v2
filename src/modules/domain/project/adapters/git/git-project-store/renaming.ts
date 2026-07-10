import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  commitStagedChanges as commitStagedChangesInGit,
  renameFile as renameFileInGit,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { NotFoundError, RepositoryError } from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type RenamingOps = Pick<
  ProjectStore,
  'renameDocumentInProject' | 'renameDirectory'
>;

export const createRenamingOps = ({
  isoGitFs,
  filesystem,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
}): RenamingOps => {
  // Git-renames a batch of documents and commits. Internal helper for the
  // directory rename (the working-tree move is handled by the caller).
  const renameDocumentsInGit = ({
    projectPath,
    documentRenames,
  }: {
    projectPath: string;
    documentRenames: Array<{
      oldDocumentPath: string;
      newDocumentPath: string;
    }>;
  }) =>
    pipe(
      Effect.forEach(documentRenames, ({ oldDocumentPath, newDocumentPath }) =>
        renameFileInGit({
          isoGitFs,
          dir: projectPath,
          oldPath: oldDocumentPath,
          newPath: newDocumentPath,
        })
      ),
      Effect.flatMap(() =>
        commitStagedChangesInGit({
          isoGitFs,
          dir: projectPath,
          message:
            documentRenames.length === 1
              ? `Renamed ${documentRenames[0].oldDocumentPath} to ${documentRenames[0].newDocumentPath}`
              : `Renamed ${documentRenames.length} documents`,
        })
      ),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      ),
      Effect.asVoid
    );

  const renameDocumentInProject: RenamingOps['renameDocumentInProject'] = ({
    projectId,
    oldDocumentPath,
    newDocumentPath,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          // Rename in the working tree first.
          Effect.all([
            filesystem.getAbsolutePath({
              path: oldDocumentPath,
              dirPath: projectPath,
            }),
            filesystem.getAbsolutePath({
              path: newDocumentPath,
              dirPath: projectPath,
            }),
          ]),
          Effect.flatMap(([oldAbsolutePath, newAbsolutePath]) =>
            filesystem.rename({
              oldPath: oldAbsolutePath,
              newPath: newAbsolutePath,
            })
          ),
          Effect.flatMap(() =>
            renameFileInGit({
              isoGitFs,
              dir: projectPath,
              oldPath: oldDocumentPath,
              newPath: newDocumentPath,
            })
          ),
          Effect.flatMap(() =>
            commitStagedChangesInGit({
              isoGitFs,
              dir: projectPath,
              message: `Renamed ${oldDocumentPath} to ${newDocumentPath}`,
            })
          ),
          // The filesystem AlreadyExistsError is left intact — the renderer
          // relies on it to report a rename collision.
          Effect.catchTags({
            [VersionControlRepositoryErrorTag]: (err) =>
              Effect.fail(new RepositoryError(err.message)),
            [FilesystemAccessControlErrorTag]: (err) =>
              Effect.fail(new RepositoryError(err.message)),
            [FilesystemNotFoundErrorTag]: (err) =>
              Effect.fail(new NotFoundError(err.message)),
            [FilesystemRepositoryErrorTag]: (err) =>
              Effect.fail(new RepositoryError(err.message)),
          })
        )
      )
    );

  const renameDirectory: RenamingOps['renameDirectory'] = ({
    projectId,
    oldDirectoryPath,
    newDirectoryName,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          filesystem.getRenamedPath({
            oldPath: oldDirectoryPath,
            newName: newDirectoryName,
          }),
          Effect.flatMap((newDirectoryPath) =>
            pipe(
              Effect.all([
                filesystem.getAbsolutePath({
                  path: oldDirectoryPath,
                  dirPath: projectPath,
                }),
                filesystem.getAbsolutePath({
                  path: newDirectoryPath,
                  dirPath: projectPath,
                }),
              ]),
              Effect.flatMap(([absOldDir, absNewDir]) =>
                pipe(
                  // List files before renaming so we can build the rename pairs.
                  filesystem.listDirectoryFiles({
                    path: absOldDir,
                    recursive: true,
                  }),
                  Effect.flatMap((files) =>
                    Effect.forEach(files, (file) =>
                      filesystem.getRelativePath({
                        path: file.path,
                        relativeTo: projectPath,
                      })
                    )
                  ),
                  Effect.flatMap((oldDocumentPaths) =>
                    pipe(
                      filesystem.rename({
                        oldPath: absOldDir,
                        newPath: absNewDir,
                      }),
                      Effect.flatMap(() => {
                        const documentRenames = oldDocumentPaths.map(
                          (oldDocumentPath) => ({
                            oldDocumentPath,
                            // Replace the old directory prefix with the new one.
                            newDocumentPath:
                              newDirectoryPath +
                              oldDocumentPath.slice(oldDirectoryPath.length),
                          })
                        );

                        return documentRenames.length === 0
                          ? Effect.void
                          : renameDocumentsInGit({
                              projectPath,
                              documentRenames,
                            });
                      })
                    )
                  )
                )
              ),
              Effect.map(() => ({ newDirectoryPath }))
            )
          ),
          // AlreadyExistsError left intact for the renderer's collision message.
          Effect.catchTags({
            [FilesystemAccessControlErrorTag]: (e) =>
              Effect.fail(new RepositoryError(e.message)),
            [FilesystemDataIntegrityErrorTag]: (e) =>
              Effect.fail(new RepositoryError(e.message)),
            [FilesystemNotFoundErrorTag]: (e) =>
              Effect.fail(new NotFoundError(e.message)),
            [FilesystemRepositoryErrorTag]: (e) =>
              Effect.fail(new RepositoryError(e.message)),
          })
        )
      )
    );

  return {
    renameDocumentInProject,
    renameDirectory,
  };
};
