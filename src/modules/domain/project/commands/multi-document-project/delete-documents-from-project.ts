import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import {
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type DeleteDocumentsFromProjectArgs = {
  documentIds: ResolvedArtifactId[];
  projectId: ProjectId;
  deleteFromFilesystem?: boolean;
  directoryPath?: string;
};

export type DeleteDocumentsFromProjectDeps = {
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  deleteDocumentsFromProjectStore: MultiDocumentProjectStore['deleteDocumentsFromProject'];
  deleteDirectory: Filesystem['deleteDirectory'];
};

export const deleteDocumentsFromProject =
  ({
    deleteDocument,
    deleteDocumentsFromProjectStore,
    deleteDirectory,
  }: DeleteDocumentsFromProjectDeps) =>
  ({
    documentIds,
    projectId,
    deleteFromFilesystem,
    directoryPath,
  }: DeleteDocumentsFromProjectArgs): Effect.Effect<
    void,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
    | MigrationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      deleteFromFilesystem && directoryPath
        ? deleteDirectory({ path: directoryPath })
        : Effect.void,
      Effect.flatMap(() =>
        deleteDocumentsFromProjectStore({ documentIds, projectId })
      ),
      Effect.flatMap(() =>
        Effect.forEach(documentIds, (documentId) =>
          // The folder has already been deleted earlier in the pipeline.
          deleteDocument({ documentId, deleteFromFilesystem: false })
        )
      ),
      Effect.map(() => undefined)
    );
