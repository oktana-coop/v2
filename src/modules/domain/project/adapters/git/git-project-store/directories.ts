import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../../../../modules/domain/rich-text';
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
import { resolveAbsolutePath } from './artifacts';
import { ensureProjectIdIsFsPath } from './project-id';

type DocumentOps = Pick<ProjectStore, 'findDocumentByPath' | 'deleteDocuments'>;

type DirectoryOps = Pick<ProjectStore, 'createDirectory' | 'deleteDirectory'>;

const documentExtensions = [
  richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
];

export const createDirectoryOps = ({
  filesystem,
  documentOps,
}: {
  filesystem: Filesystem;
  documentOps: DocumentOps;
}): DirectoryOps => {
  const createDirectory = ({
    projectId,
    parentDirectoryId,
    name,
  }: CreateDirectoryArgs) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          parentDirectoryId
            ? resolveAbsolutePath({
                filesystem,
                projectDir,
                artifactId: parentDirectoryId,
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

  const deleteDirectory = ({ projectId, directoryId }: DeleteDirectoryArgs) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectDir) =>
        pipe(
          resolveAbsolutePath({
            filesystem,
            projectDir,
            artifactId: directoryId,
          }),
          Effect.flatMap((absoluteDirPath) =>
            pipe(
              filesystem.listDirectoryFiles({
                path: absoluteDirPath,
                recursive: true,
                extensions: documentExtensions,
              }),
              // Resolve the tracked documents inside the directory (untracked
              // files are silently skipped).
              Effect.flatMap((files) =>
                Effect.forEach(files, (file) =>
                  pipe(
                    filesystem.getRelativePath({
                      path: file.path,
                      relativeTo: projectDir,
                    }),
                    Effect.flatMap((fileRelativePath) =>
                      pipe(
                        documentOps.findDocumentByPath({
                          projectId,
                          documentPath: fileRelativePath,
                        }),
                        Effect.map((doc) => doc.id),
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
              Effect.flatMap((documentIds) =>
                documentIds.length > 0
                  ? documentOps.deleteDocuments({
                      documentIds,
                      projectId,
                      deleteFromFilesystem: true,
                      directoryPath: absoluteDirPath,
                    })
                  : // None of the directory's documents are tracked; just
                    // remove the directory.
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
