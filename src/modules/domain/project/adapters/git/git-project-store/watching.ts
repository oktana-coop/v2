import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';

import { type DirectoryWatcher } from '../../../../../../modules/infrastructure/filesystem';
import { GIT_DIR_NAME } from '../../../constants';
import { VersionedProjectValidationErrorTag } from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type WatchingOps = Pick<ProjectStore, 'projectContentChangeEvents'>;

export const createWatchingOps = ({
  directoryWatcher,
}: {
  directoryWatcher: DirectoryWatcher;
}): WatchingOps => {
  const projectContentChangeEvents: WatchingOps['projectContentChangeEvents'] =
    ({ projectId, emitOnStart }) =>
      pipe(
        ensureProjectIdIsFsPath(projectId),
        Effect.map((projectDir) =>
          Stream.async<void>((emit) => {
            const unwatchDirectory = directoryWatcher.watchDirectory({
              path: projectDir,
              ignoredTopLevelEntries: [GIT_DIR_NAME],
              onChange: () => {
                emit.single(undefined);
              },
            });

            if (emitOnStart) emit.single(undefined);

            // Clean-up, run when the stream ends: once nobody listens.
            return Effect.sync(unwatchDirectory);
          })
        ),
        Stream.unwrap,
        // A project id that isn't a filesystem path has no directory to watch.
        Stream.catchTag(VersionedProjectValidationErrorTag, () => Stream.empty)
      );

  return { projectContentChangeEvents };
};
