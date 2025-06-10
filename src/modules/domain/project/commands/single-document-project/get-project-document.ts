import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type VersionControlId } from '../../../../infrastructure/version-control';
import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../rich-text';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type SingleDocumentProjectStore } from '../../ports/single-document-project';

export type FindDocumentInProjectArgs = {
  projectId: VersionControlId;
};

export type FindDocumentInProjectDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  findDocumentInProjectStore: SingleDocumentProjectStore['findDocumentInProject'];
};

export const getProjectDocument =
  ({
    findDocumentInProjectStore,
    findDocumentById,
  }: FindDocumentInProjectDeps) =>
  ({
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
      findDocumentInProjectStore(projectId),
      Effect.flatMap((artifactId) => findDocumentById(artifactId))
    );
