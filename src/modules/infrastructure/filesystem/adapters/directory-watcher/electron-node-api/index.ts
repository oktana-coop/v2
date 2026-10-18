import { watch } from 'node:fs';

import debounce from 'debounce';

import { isLinux } from '../../../../cross-platform/node';
import { type DirectoryWatcher } from '../../../ports/directory-watcher';
import { watchPerDirectory } from './per-directory-watch';
import { type WatchTree } from './tree-watch';

// Editors and git rewrite a file in several steps, so events arrive in bursts.
// One signal per lull is enough for a listener that re-reads anyway.
const COALESCE_MS = 100;

export const isIgnored = ({
  filename,
  ignoredTopLevelEntries,
}: {
  filename: string | null;
  ignoredTopLevelEntries: string[];
}): boolean => {
  // Node does not always report a filename: unsupported platforms (BSD,
  // SunOS, etc.) never do, and supported ones do not guarantee it.
  if (filename === null) return false;

  // Node reports the entry relative to the watched directory, in the
  // platform's separators.
  const [topLevelEntry] = filename.split(/[/\\]/);

  return ignoredTopLevelEntries.includes(topLevelEntry);
};

const watchRecursively: WatchTree = ({ path, onEvent, onError }) => {
  const watcher = watch(path, { recursive: true }, (_, filename) =>
    onEvent(filename)
  );
  watcher.on('error', onError);

  return () => watcher.close();
};

// Node's recursive watch loses files replaced by a rename on Linux.
//
// TODO: Watch recursively everywhere once Electron bundles a Node that has the
// fix (v26.9.0 and later).
const watchTree: WatchTree = isLinux() ? watchPerDirectory : watchRecursively;

type Listener = {
  notify: debounce.DebouncedFunction<() => void>;
  ignoredTopLevelEntries: string[];
};

type WatchedDirectory = {
  listeners: Set<Listener>;
  closeWatch: () => void;
};

export const createAdapter = (): DirectoryWatcher => {
  // One operating-system watch per directory, shared by everyone watching it.
  const watched = new Map<string, WatchedDirectory>();

  const closeDirectory = (path: string) => {
    const directory = watched.get(path);

    if (!directory) return;

    directory.listeners.forEach((listener) => listener.notify.clear());
    directory.closeWatch();
    watched.delete(path);
  };

  // Resolves to null when the directory can't be watched, which yields no
  // signals rather than an error.
  const openDirectory = (path: string): WatchedDirectory | null => {
    const listeners = new Set<Listener>();

    try {
      const closeWatch = watchTree({
        path,
        onEvent: (filename) => {
          listeners.forEach((listener) => {
            if (
              isIgnored({
                filename,
                ignoredTopLevelEntries: listener.ignoredTopLevelEntries,
              })
            ) {
              return;
            }

            // Node explicitly warns that watch behavior is not fully consistent
            // across platforms, so any event is only a signal that something changed.
            listener.notify();
          });
        },
        // A watched directory that disappears surfaces here instead of
        // throwing, and leaves nothing behind to stop later.
        onError: () => closeDirectory(path),
      });

      const directory = { listeners, closeWatch };
      watched.set(path, directory);

      return directory;
    } catch {
      return null;
    }
  };

  return {
    watchDirectory: ({ path, onChange, ignoredTopLevelEntries = [] }) => {
      const directory = watched.get(path) ?? openDirectory(path);

      if (!directory) return () => {};

      const listener: Listener = {
        notify: debounce(onChange, COALESCE_MS),
        ignoredTopLevelEntries,
      };

      directory.listeners.add(listener);

      return () => {
        listener.notify.clear();

        // The watch may already be gone, after an error or a full stop.
        if (watched.get(path) !== directory) return;

        directory.listeners.delete(listener);
        if (directory.listeners.size === 0) closeDirectory(path);
      };
    },
    unwatchAllDirectories: () => {
      Array.from(watched.keys()).forEach(closeDirectory);
    },
  };
};
