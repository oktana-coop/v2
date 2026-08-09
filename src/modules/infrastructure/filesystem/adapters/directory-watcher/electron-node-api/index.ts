import { watch } from 'node:fs';

import debounce from 'debounce';

import { type DirectoryWatcher } from '../../../ports/directory-watcher';

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

export const createAdapter = (): DirectoryWatcher => {
  const watched = new Map<string, () => void>();

  const unwatchDirectory = (path: string) => {
    const stop = watched.get(path);

    if (!stop) return;

    stop();
    watched.delete(path);
  };

  return {
    watchDirectory: ({ path, onChange, ignoredTopLevelEntries = [] }) => {
      if (watched.has(path)) return;

      const notify = debounce(onChange, COALESCE_MS);

      try {
        const watcher = watch(path, { recursive: true }, (_, filename) => {
          if (isIgnored({ filename, ignoredTopLevelEntries })) return;

          // Node explicitly warns that watch behavior is not fully consistent
          // across platforms, so any event is only a signal that something changed.
          notify();
        });

        // A watched directory that disappears surfaces here instead of
        // throwing, and leaves nothing behind to stop later.
        watcher.on('error', () => unwatchDirectory(path));

        watched.set(path, () => {
          notify.clear();
          watcher.close();
        });
      } catch {
        // An unwatchable directory yields no signals rather than an error.
        notify.clear();
      }
    },
    unwatchDirectory,
    unwatchAllDirectories: () => {
      watched.forEach((stop) => stop());
      watched.clear();
    },
  };
};
