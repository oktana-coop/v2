import * as Effect from 'effect/Effect';
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
} from '../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../modules/infrastructure/version-control';
import { RepositoryError, ValidationError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';

export type CreateDocumentInProjectArgs = {
  content: string | null;
  projectId: ProjectId;
  projectDirectory: Directory | null;
  parentDirectory: Directory | null;
};

export type CreateDocumentInProjectDeps = {
  createNewFile: Filesystem['createNewFile'];
  getRelativePath: Filesystem['getRelativePath'];
  createDocument: ProjectStore['createDocument'];
};

export type CreateDocumentInProjectResult = {
  documentId: ResolvedArtifactId;
  filePath: string;
};

export const createDocumentInProject =
  ({
    createNewFile,
    getRelativePath,
    createDocument,
  }: CreateDocumentInProjectDeps) =>
  ({
    content,
    projectId,
    projectDirectory,
    parentDirectory,
  }: CreateDocumentInProjectArgs): Effect.Effect<
    Option.Option<CreateDocumentInProjectResult>,
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | ValidationError
    | RepositoryError,
    never
  > =>
    Effect.Do.pipe(
      // TODO: Consider handling this in project store
      // (especially if we get rid of the create-file dialog, which is a UI concern)
      Effect.bind('newFile', () => {
        const parentDir = parentDirectory ?? projectDirectory;

        return createNewFile({
          parentDirectory: parentDir ?? undefined,
          extensions: [
            richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
          ],
          content: content ?? undefined,
        });
      }),
      Effect.bind('filePath', ({ newFile }) =>
        projectDirectory
          ? getRelativePath({
              path: newFile.path,
              relativeTo: projectDirectory.path,
            })
          : Effect.succeed(newFile.path)
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
