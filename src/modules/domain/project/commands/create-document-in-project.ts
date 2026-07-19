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
import { type ProjectId, type ProjectRelPath } from '../models';
import { type ProjectStore } from '../ports';

export type CreateDocumentInProjectArgs = {
  content: string | null;
  projectId: ProjectId;
  projectDirectory: Directory;
  parentDirectoryPath: ProjectRelPath | undefined;
};

export type CreateDocumentInProjectDeps = {
  createNewFile: Filesystem['createNewFile'];
  getRelativePath: Filesystem['getRelativePath'];
  getAbsolutePath: Filesystem['getAbsolutePath'];
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
    createDocument,
  }: CreateDocumentInProjectDeps) =>
  ({
    content,
    projectId,
    projectDirectory,
    parentDirectoryPath,
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
          parentDirectoryPath
            ? pipe(
                getAbsolutePath({
                  path: parentDirectoryPath,
                  dirPath: projectDirectory.path,
                }),
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
