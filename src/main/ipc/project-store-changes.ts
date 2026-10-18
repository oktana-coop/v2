import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import { ipcMain } from 'electron';

import {
  type ProjectContentChangeEventsArgs,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../modules/domain/project/node';
import { serveStreamOverIPC } from '../../modules/infrastructure/cross-platform';
import { validateProjectIdAndGetProjectStore } from '../project-stores';

export const registerProjectStoreChangesEvents = () => {
  serveStreamOverIPC({
    ipcMain,
    channel: 'project-store:project-content-change-events',
    streamFor: ({ projectId, emitOnStart }: ProjectContentChangeEventsArgs) =>
      pipe(
        validateProjectIdAndGetProjectStore(projectId),
        Effect.map((projectStore) =>
          projectStore.projectContentChangeEvents({ projectId, emitOnStart })
        ),
        Stream.unwrap,
        // An invalid project id, or a project whose store this process doesn't
        // hold, has no changes to report.
        Stream.catchTags({
          [VersionedProjectValidationErrorTag]: () => Stream.empty,
          [VersionedProjectNotFoundErrorTag]: () => Stream.empty,
        })
      ),
  });
};
