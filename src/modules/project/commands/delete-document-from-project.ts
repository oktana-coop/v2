import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../modules/rich-text';
import { type VersionControlId } from '../../../modules/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../errors';
import { type VersionedProjectStore } from '../ports/versioned-project-store';

export type DeleteDocumentFromProjectArgs = {
  documentId: VersionControlId;
  projectId: VersionControlId;
};

export type DeleteDocumentFromProjectDeps = {
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  deleteArtifactFromProject: VersionedProjectStore['deleteArtifactFromProject'];
};

export const deleteDocumentFromProject =
  ({
    deleteDocument,
    deleteArtifactFromProject,
  }: DeleteDocumentFromProjectDeps) =>
  ({
    documentId,
    projectId,
  }: DeleteDocumentFromProjectArgs): Effect.Effect<
    void,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError,
    never
  > =>
    pipe(
      deleteArtifactFromProject({ artifactId: documentId, projectId }),
      Effect.flatMap(() => deleteDocument(documentId))
    );
