import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
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

export type DeleteDocumentFromProjectArgs = {
  documentId: ResolvedArtifactId;
  projectId: ProjectId;
};

export type DeleteDocumentFromProjectDeps = {
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  deleteDocumentFromProjectStore: MultiDocumentProjectStore['deleteDocumentFromProject'];
};

export const deleteDocumentFromProject =
  ({
    deleteDocument,
    deleteDocumentFromProjectStore,
  }: DeleteDocumentFromProjectDeps) =>
  ({
    documentId,
    projectId,
  }: DeleteDocumentFromProjectArgs): Effect.Effect<
    void,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
    | MigrationError,
    never
  > =>
    pipe(
      deleteDocumentFromProjectStore({ documentId, projectId }),
      Effect.flatMap(() => deleteDocument(documentId))
    );
