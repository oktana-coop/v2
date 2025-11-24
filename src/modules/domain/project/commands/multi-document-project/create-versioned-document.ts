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
  PRIMARY_RICH_TEXT_REPRESENTATION,
  RepositoryError as VersionedDocumentRepositoryError,
  richTextRepresentationExtensions,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../rich-text';
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
  getRelativePath: Filesystem['getRelativePath'];
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
    getRelativePath,
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
    | VersionedDocumentValidationError
    | VersionedProjectValidationError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('newFile', () =>
        directory
          ? createNewFile({
              parentDirectory: directory,
              extensions: [
                richTextRepresentationExtensions[
                  PRIMARY_RICH_TEXT_REPRESENTATION
                ],
              ],
            })
          : createNewFile({
              extensions: [
                richTextRepresentationExtensions[
                  PRIMARY_RICH_TEXT_REPRESENTATION
                ],
              ],
            })
      ),
      Effect.bind('documentId', ({ newFile }) =>
        pipe(
          directory
            ? getRelativePath({
                path: newFile.path,
                relativeTo: directory.path,
              })
            : Effect.succeed(newFile.path),
          Effect.flatMap((filePath) =>
            createDocument({
              content,
              filePath,
            })
          )
        )
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
