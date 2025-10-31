import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AbortError as FilesystemAbortError,
  type Directory,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../infrastructure/version-control';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import { RICH_TEXT_FILE_EXTENSION } from '../../constants/file-extensions';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type CreateVersionedDocumentArgs = {
  content: string | null;
  projectId: ProjectId | null;
  directory: Directory | null;
};

export type CreateVersionedDocumentDeps = {
  createNewFile: Filesystem['createNewFile'];
  createDocument: VersionedDocumentStore['createDocument'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
};

export type CreateVersionedDocumentResult = {
  documentId: ResolvedArtifactId;
  filePath: string;
};

export const createVersionedDocument =
  ({
    createNewFile,
    createDocument,
    addDocumentToProject,
  }: CreateVersionedDocumentDeps) =>
  ({
    content,
    projectId,
    directory,
  }: CreateVersionedDocumentArgs): Effect.Effect<
    CreateVersionedDocumentResult,
    | FilesystemAbortError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | VersionedProjectValidationError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('newFile', () =>
        directory
          ? createNewFile({
              parentDirectory: directory,
              extensions: [RICH_TEXT_FILE_EXTENSION],
            })
          : createNewFile({
              extensions: [RICH_TEXT_FILE_EXTENSION],
            })
      ),
      Effect.bind('documentId', () =>
        createDocument({
          content,
        })
      ),
      Effect.tap(({ documentId, newFile }) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.as(undefined),
            onSome: (projId) =>
              addDocumentToProject({
                documentId,
                name: newFile.name,
                path: newFile.path,
                projectId: projId,
              }),
          })
        )
      ),
      Effect.flatMap(({ documentId, newFile }) =>
        Effect.succeed({ documentId, filePath: newFile.path })
      )
    );
