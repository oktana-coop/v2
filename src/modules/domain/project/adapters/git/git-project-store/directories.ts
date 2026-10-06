import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type Filesystem,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  toDirectory,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  NotFoundError,
  RepositoryError,
  VersionedProjectNotFoundErrorTag,
} from '../../../errors';
import {
  type CreateDirectoryArgs,
  type DeleteDirectoryArgs,
  type ProjectStore,
} from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type DocumentOps = Pick<
  ProjectStore,
  'lookupArtifactInProject' | 'deleteDocuments'
>;

type DirectoryOps = Pick<ProjectStore, 'createDirectory' | 'deleteDirectory'>;

export const createDirectoryOps = ({
  filesystem,
  documentOps,
}: {
  filesystem: Filesystem;
  documentOps: DocumentOps;
}): DirectoryOps => {
  const createDirectory = ({
    projectId,
    parentDirectoryPath,
    name,
  }: CreateDirectoryArgs) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          parentDirectoryPath
            ? filesystem.getAbsolutePath({
                path: parentDirectoryPath,
                dirPath: projectDir,
              })
            : Effect.succeed(projectDir),
          Effect.flatMap((parentAbsolutePath) =>
            filesystem.createDirectory({
              name,
              parentDirectory: toDirectory({ path: parentAbsolutePath }),
            })
          ),
          Effect.asVoid
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: (e) =>
          Effect.fail(new NotFoundError(e.message)),
        [FilesystemRepositoryErrorTag]: (e) =>
          Effect.fail(new RepositoryError(e.message)),
      })
    );

  const deleteDirectory = ({ projectId, directoryPath }: DeleteDirectoryArgs) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          filesystem.getAbsolutePath({
            path: directoryPath,
            dirPath: projectDir,
          }),
          Effect.flatMap((absoluteDirPath) =>
            pipe(
              filesystem.listDirectoryFiles({
                path: absoluteDirPath,
                recursive: true,
              }),
              // Resolve the files inside the directory (files the lookup can't
              // find are skipped).
              Effect.flatMap((files) =>
                Effect.forEach(files, (file) =>
                  pipe(
                    filesystem.getRelativePath({
                      path: file.path,
                      relativeTo: projectDir,
                    }),
                    Effect.flatMap((fileRelativePath) =>
                      pipe(
                        documentOps.lookupArtifactInProject({
                          projectId,
                          path: fileRelativePath,
                        }),
                        Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
                          Effect.succeed(null)
                        )
                      )
                    )
                  )
                )
              ),
              Effect.map((ids) =>
                ids.filter((id): id is NonNullable<typeof id> => id !== null)
              ),
              Effect.flatMap((artifactIds) =>
                artifactIds.length > 0
                  ? documentOps.deleteDocuments({
                      documentIds: artifactIds,
                      projectId,
                      deleteFromFilesystem: true,
                      directoryPath: absoluteDirPath,
                    })
                  : // None of the directory's files were found; just remove
                    // the directory.
                    pipe(
                      filesystem.deleteDirectory({ path: absoluteDirPath }),
                      Effect.catchAll(() =>
                        Effect.fail(
                          new RepositoryError('Could not delete directory')
                        )
                      )
                    )
              ),
              Effect.asVoid
            )
          )
        )
      ),
      Effect.catchTags({
        [FilesystemDataIntegrityErrorTag]: (e) =>
          Effect.fail(new RepositoryError(e.message)),
        [FilesystemNotFoundErrorTag]: (e) =>
          Effect.fail(new NotFoundError(e.message)),
        [FilesystemRepositoryErrorTag]: (e) =>
          Effect.fail(new RepositoryError(e.message)),
      })
    );

  return {
    createDirectory,
    deleteDirectory,
  };
};
