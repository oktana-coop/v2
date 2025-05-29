import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../../modules/domain/rich-text';
import { type VersionControlId } from '../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../errors';
import { type VersionedProjectStore } from '../ports/versioned-project-store';

export type FindDocumentInProjectArgs = {
  documentPath: string;
  projectId: VersionControlId;
};

export type FindDocumentInProjectDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  findDocumentInProjectStore: VersionedProjectStore['findDocumentInProject'];
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
    VersionedDocumentHandle,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError,
    never
  > =>
    pipe(
      findDocumentInProjectStore({ documentPath, projectId }),
      Effect.flatMap((artifactId) => findDocumentById(artifactId))
    );
