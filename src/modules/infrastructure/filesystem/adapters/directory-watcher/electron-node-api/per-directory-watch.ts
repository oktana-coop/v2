import { type FSWatcher, lstatSync, readdirSync, watch } from 'node:fs';
import { join, sep } from 'node:path';

import { type WatchTree } from './tree-watch';

// Node's recursive watch on Linux (up to v26.9.0) watches each file on its
// own, so a file replaced by a rename (git checkout, an editor's atomic save)
// is never reported again: the watch stays on the replaced file.
// Watching each directory instead reports any entry that changes in it,
// replaced or not, which is what Node itself moved to.
// See https://github.com/nodejs/node/pull/65486.

const isDirectory = (path: string): boolean => {
  try {
    // Symbolic links are not followed, so a link cannot lead into a cycle.
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};

const listSubdirectories = (path: string): string[] => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

export const watchPerDirectory: WatchTree = ({ path, onEvent, onError }) => {
  // Keyed by the directory relative to `path`, with '' for `path` itself, so
  // entries are reported the way Node's recursive watch reports them. Joining
  // a key to `path` gives the directory on disk, and joining a name a watch
  // reports to its key gives that entry's own key.
  const watches = new Map<string, FSWatcher>();

  // Stops watching the directory and everything under it.
  const unwatch = (directory: string) => {
    const isUnder = (key: string) =>
      directory === '' ||
      key === directory ||
      key.startsWith(`${directory}${sep}`);

    Array.from(watches.keys())
      .filter(isUnder)
      .forEach((key) => {
        watches.get(key)?.close();
        watches.delete(key);
      });
  };

  const onDirectoryEvent = ({
    directory,
    name,
  }: {
    directory: string;
    name: string | null;
  }) => {
    if (name === null) {
      onEvent(directory === '' ? null : directory);
      return;
    }

    const entry = join(directory, name);

    // An entry that is a directory now gets watched, and one that no longer
    // is stops being watched. Anything created in a new directory before its
    // watch started is covered by the event below.
    if (isDirectory(join(path, entry))) watchFrom(entry);
    else unwatch(entry);

    onEvent(entry);
  };

  // Watches the directory and everything under it that isn't watched yet.
  const watchFrom = (directory: string) => {
    if (watches.has(directory)) return;

    try {
      const watcher = watch(join(path, directory), (_, name) =>
        onDirectoryEvent({ directory, name })
      );

      // A nested directory that disappears is also reported by its parent,
      // so only the watched directory itself failing ends the watch.
      watcher.on('error', () =>
        directory === '' ? onError() : unwatch(directory)
      );

      watches.set(directory, watcher);
    } catch {
      // Gone before it could be watched.
      return;
    }

    listSubdirectories(join(path, directory)).forEach((name) =>
      watchFrom(join(directory, name))
    );
  };

  watchFrom('');

  if (!watches.has('')) throw new Error(`Cannot watch ${path}`);

  return () => unwatch('');
};
