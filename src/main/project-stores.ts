import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  isValidProjectId,
  NotFoundError,
  type ProjectId,
  type ProjectStore,
  ValidationError,
} from '../modules/domain/project';
import { fromNullable } from '../utils/effect';

export type ProjectStoresMap = Map<ProjectId, ProjectStore>;

export const projectStoresMap: ProjectStoresMap = new Map();

/**
 * Get the project store for a project id.
 */
export const getProjectStore = (
  projectId: ProjectId
): Effect.Effect<ProjectStore, NotFoundError, never> =>
  pipe(
    Effect.succeed(projectStoresMap.get(projectId)),
    Effect.flatMap((store) =>
      fromNullable(
        store,
        () =>
          new NotFoundError(
            'Could not find project store for the given project.'
          )
      )
    )
  );

export const validateProjectIdAndGetProjectStore = (
  projectId: string
): Effect.Effect<ProjectStore, ValidationError | NotFoundError, never> =>
  pipe(
    Effect.succeed(projectId),
    Effect.filterOrFail(
      isValidProjectId,
      (val) => new ValidationError(`Invalid project id: ${val}`)
    ),
    Effect.flatMap((projId) => Effect.succeed(projectStoresMap.get(projId))),
    Effect.flatMap((store) =>
      fromNullable(
        store,
        () =>
          new NotFoundError(
            'Could not find project store for the given project.'
          )
      )
    )
  );

/**
 * Set/register the project store for a project id. Overwrites any existing entry.
 */
export const setProjectStore = (
  projectId: ProjectId,
  store: ProjectStore
): Effect.Effect<void, never, never> =>
  Effect.sync(() => projectStoresMap.set(projectId, store));

/**
 * Delete/unregister the project store for a project id.
 */
export const deleteProjectStore = (
  projectId: ProjectId
): Effect.Effect<void, never, never> =>
  Effect.sync(() => projectStoresMap.delete(projectId));
