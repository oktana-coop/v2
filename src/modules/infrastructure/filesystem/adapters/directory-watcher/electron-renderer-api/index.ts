import { type DirectoryWatcher } from '../../../ports/directory-watcher';

export const createAdapter = (): DirectoryWatcher => {
  // One listener per watched directory (currently just one).
  const listeners = new Map<string, () => void>();

  const unwatchDirectory = (path: string) => {
    const unregister = listeners.get(path);

    if (!unregister) return;

    unregister();
    listeners.delete(path);
    window.directoryWatcherAPI.stopWatching(path);
  };

  return {
    watchDirectory: ({ path, onChange, ignoredTopLevelEntries = [] }) => {
      if (listeners.has(path)) return;

      listeners.set(
        path,
        window.directoryWatcherAPI.onDirectoryChanged((changedPath) => {
          // Only react to watch events the listener is interested in
          // (concerning its directory path).
          if (changedPath === path) onChange();
        })
      );

      window.directoryWatcherAPI.startWatching({
        path,
        ignoredTopLevelEntries,
      });
    },
    unwatchDirectory,
    unwatchAllDirectories: () => {
      Array.from(listeners.keys()).forEach(unwatchDirectory);
    },
  };
};
