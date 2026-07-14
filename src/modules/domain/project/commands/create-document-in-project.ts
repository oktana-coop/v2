import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../../modules/domain/rich-text';
import {
  type Directory,
  type Filesystem,
  FilesystemAbortErrorTag,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
  toDirectory,
} from '../../../../modules/infrastructure/filesystem';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';

export type CreateDocumentInProjectArgs = {
  content: string | null;
  projectId: ProjectId;
  projectDirectory: Directory;
  parentDirectoryId: ArtifactId | undefined;
};

export type CreateDocumentInProjectDeps = {
  createNewFile: Filesystem['createNewFile'];
  getRelativePath: Filesystem['getRelativePath'];
  getAbsolutePath: Filesystem['getAbsolutePath'];
  getArtifactPathById: ProjectStore['getArtifactPathById'];
  createDocument: ProjectStore['createDocument'];
};

export type CreateDocumentInProjectResult = {
  documentId: ArtifactId;
  filePath: string;
};

export const createDocumentInProject =
  ({
    createNewFile,
    getRelativePath,
    getAbsolutePath,
    getArtifactPathById,
    createDocument,
  }: CreateDocumentInProjectDeps) =>
  ({
    content,
    projectId,
    projectDirectory,
    parentDirectoryId,
  }: CreateDocumentInProjectArgs): Effect.Effect<
    Option.Option<CreateDocumentInProjectResult>,
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | ValidationError
    | RepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('newFile', () =>
        pipe(
          // Resolve the parent directory to create the file under (the project
          // root when none is given).
          parentDirectoryId
            ? pipe(
                getArtifactPathById({
                  projectId,
                  artifactId: parentDirectoryId,
                }),
                Effect.flatMap((relPath) =>
                  getAbsolutePath({
                    path: relPath,
                    dirPath: projectDirectory.path,
                  })
                ),
                Effect.map((absolutePath) =>
                  toDirectory({ path: absolutePath })
                )
              )
            : Effect.succeed(projectDirectory),
          Effect.flatMap((parentDirectory) =>
            createNewFile({
              parentDirectory,
              extensions: [
                richTextRepresentationExtensions[
                  PRIMARY_RICH_TEXT_REPRESENTATION
                ],
              ],
              content: content ?? undefined,
            })
          )
        )
      ),
      Effect.bind('filePath', ({ newFile }) =>
        getRelativePath({
          path: newFile.path,
          relativeTo: projectDirectory.path,
        })
      ),
      Effect.bind('documentId', ({ filePath }) =>
        createDocument({
          projectId,
          content,
          filePath,
        })
      ),
      Effect.map(({ documentId, filePath }) =>
        Option.some({ documentId, filePath })
      ),
      // Return Option.none if the user cancelled the dialog.
      Effect.catchTag(FilesystemAbortErrorTag, () =>
        Effect.succeed(Option.none<CreateDocumentInProjectResult>())
      )
    );
