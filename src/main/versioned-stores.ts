import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  isValidProjectId,
  type MultiDocumentProjectStore,
  NotFoundError,
  type ProjectId,
  type SingleDocumentProjectStore,
  ValidationError,
} from '../modules/domain/project';
import { type VersionedDocumentStore } from '../modules/domain/rich-text';
import { fromNullable } from '../utils/effect';

export type VersionedStores = {
  versionedProjectStore: MultiDocumentProjectStore | SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

export type MultiDocumentProjectVersionedStores = {
  versionedProjectStore: MultiDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

export type SingleDocumentProjectVersionedStores = {
  versionedProjectStore: SingleDocumentProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

export const isMultiDocumentProjectVersionedStores = (
  versionedStores: VersionedStores
): versionedStores is MultiDocumentProjectVersionedStores =>
  'listProjectDocuments' in versionedStores.versionedProjectStore;

export const isSingleDocumentProjectVersionedStores = (
  versionedStores: VersionedStores
): versionedStores is SingleDocumentProjectVersionedStores =>
  'findDocumentInProject' in versionedStores.versionedProjectStore;

export type VersionedStoresMap = Map<ProjectId, VersionedStores>;

export const versionedStoresMap: VersionedStoresMap = new Map();

/**
 * Get the versioned stores (project + document store) for a project id.
 */
export const getVersionedStores = (
  projectId: ProjectId
): Effect.Effect<VersionedStores, NotFoundError, never> =>
  pipe(
    Effect.succeed(versionedStoresMap.get(projectId)),
    Effect.flatMap((stores) =>
      fromNullable(
        stores,
        () =>
          new NotFoundError(
            'Could not find versioned stores for the given project.'
          )
      )
    )
  );

export const validateProjectIdAndGetVersionedStores = (
  projectId: string
): Effect.Effect<VersionedStores, ValidationError | NotFoundError, never> =>
  pipe(
    Effect.succeed(projectId),
    Effect.filterOrFail(
      isValidProjectId,
      (val) => new ValidationError(`Invalid project id: ${val}`)
    ),
    Effect.flatMap((projId) => Effect.succeed(versionedStoresMap.get(projId))),
    Effect.flatMap((stores) =>
      fromNullable(
        stores,
        () =>
          new NotFoundError(
            'Could not find versioned stores for the given project.'
          )
      )
    ),
    Effect.flatMap((stores) =>
      stores.versionedDocumentStore.projectId === projectId
        ? Effect.succeed(stores)
        : Effect.fail(
            new ValidationError(
              `The document store contains a project ID that doesn't match the passed one.`
            )
          )
    )
  );

/**
 * Set/register the versioned stores for a project id. Overwrites any existing entry.
 */
export const setVersionedStores = (
  projectId: ProjectId,
  stores: VersionedStores
): Effect.Effect<void, never, never> =>
  Effect.sync(() => versionedStoresMap.set(projectId, stores));

/**
 * Delete/unregister the versioned stores for a project id.
 */
export const deleteVersionedStores = (
  projectId: ProjectId
): Effect.Effect<void, never, never> =>
  Effect.sync(() => versionedStoresMap.delete(projectId));
