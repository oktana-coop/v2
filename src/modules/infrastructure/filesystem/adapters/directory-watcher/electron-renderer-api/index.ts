import { type DirectoryWatcher } from '../../../ports/directory-watcher';

// The main process owns the watchers and broadcasts to the window, so every
// listener hears about every watched directory and filters by its own path.
export const createAdapter = (): DirectoryWatcher => {
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

      // Listen before asking, so a change arriving with the reply is not lost.
      listeners.set(
        path,
        window.directoryWatcherAPI.onDirectoryChanged((changedPath) => {
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
