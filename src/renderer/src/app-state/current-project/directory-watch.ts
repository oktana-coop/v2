import { useCallback, useContext, useEffect, useRef } from 'react';

import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { type ProjectContextType } from './types';

type DirectoryWatchDeps = Pick<
  ProjectContextType,
  'projectStore' | 'directory'
>;

type DirectoryWatchOps = Pick<
  ProjectContextType,
  'subscribeToProjectDirChanges'
>;

// This hook is the sole owner of project directory watching. Consumers subscribe
// here rather than starting their own, which is what keeps a single watcher per
// directory.
export const useDirectoryWatchOps = ({
  projectStore,
  directory,
}: DirectoryWatchDeps): DirectoryWatchOps => {
  const { directoryWatcher } = useContext(InfrastructureAdaptersContext);

  // The project directory is watched for as long as the project is open, and
  // listeners come and go against that one watcher.
  const listeners = useRef(new Set<() => void>());

  // Kept as primitives so that reopening the same project, which hands back an
  // equal directory with a fresh identity, does not rebuild the watcher.
  const path = directory?.path ?? null;
  const versionControlDirName = projectStore?.versionControlDirName ?? null;

  useEffect(() => {
    if (!path || !versionControlDirName) return;

    directoryWatcher.watchDirectory({
      path,
      onChange: () => listeners.current.forEach((listener) => listener()),
      ignoredTopLevelEntries: [versionControlDirName],
    });

    return () => directoryWatcher.unwatchDirectory(path);
  }, [directoryWatcher, path, versionControlDirName]);

  const subscribeToProjectDirChanges = useCallback((listener: () => void) => {
    const current = listeners.current;

    current.add(listener);

    return () => {
      current.delete(listener);
    };
  }, []);

  return { subscribeToProjectDirChanges };
};
