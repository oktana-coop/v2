import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type FindDocumentInProjectArgs = {
  documentPath: string;
  projectId: VersionControlId;
};

export type FindDocumentInProjectDeps = {
  findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
  findDocumentInProjectStore: MultiDocumentProjectStore['findDocumentInProject'];
};

export const findDocumentInProject =
  ({
    findDocumentInProjectStore,
    findDocumentHandleById,
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
      Effect.flatMap((artifactId) => findDocumentHandleById(artifactId))
    );
