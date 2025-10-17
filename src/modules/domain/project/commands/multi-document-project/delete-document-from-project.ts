import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  MigrationError,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type DeleteDocumentFromProjectArgs = {
  documentId: VersionControlId;
  projectId: VersionControlId;
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
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | MigrationError,
    never
  > =>
    pipe(
      deleteDocumentFromProjectStore({ documentId, projectId }),
      Effect.flatMap(() => deleteDocument(documentId))
    );
