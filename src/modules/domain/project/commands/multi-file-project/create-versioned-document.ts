import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import {
  AbortError as FilesystemAbortError,
  type Directory,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../infrastructure/filesystem';
import {
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type VersionedProjectStore } from '../../ports/versioned-project-store';

export type CreateVersionedDocumentArgs = {
  suggestedName: string;
  content: string | null;
  projectId: VersionControlId | null;
  directory: Directory | null;
};

export type CreateVersionedDocumentDeps = {
  createNewFile: Filesystem['createNewFile'];
  createDocument: VersionedDocumentStore['createDocument'];
  addDocumentToProject: VersionedProjectStore['addDocumentToProject'];
};

export type CreateVersionedDocumentResult = {
  documentId: VersionControlId;
  filePath: string;
};

export const createVersionedDocument =
  ({
    createNewFile,
    createDocument,
    addDocumentToProject,
  }: CreateVersionedDocumentDeps) =>
  ({
    suggestedName,
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
    | VersionedDocumentRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('newFile', () =>
        directory
          ? createNewFile(suggestedName, directory)
          : createNewFile(suggestedName)
      ),
      Effect.bind('documentId', () =>
        createDocument({
          title: suggestedName,
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
                path: newFile.path!,
                projectId: projId,
              }),
          })
        )
      ),
      Effect.flatMap(({ documentId, newFile }) =>
        Effect.succeed({ documentId, filePath: newFile.path! })
      )
    );
