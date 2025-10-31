import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type ResolvedDocument,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type FindDocumentInProjectArgs = {
  documentPath: string;
  projectId: ProjectId;
};

export type FindDocumentInProjectDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  findDocumentInProjectStore: MultiDocumentProjectStore['findDocumentInProject'];
};

export const findDocumentInProject =
  ({
    findDocumentInProjectStore,
    findDocumentById,
  }: FindDocumentInProjectDeps) =>
  ({
    documentPath,
    projectId,
  }: FindDocumentInProjectArgs): Effect.Effect<
    ResolvedDocument,
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
      findDocumentInProjectStore({ documentPath, projectId }),
      // TODO: Return the document instead of the docHandle
      // This will also handle migrating the document if needed
      Effect.flatMap((artifactId) => findDocumentById(artifactId))
    );
