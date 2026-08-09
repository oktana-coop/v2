export type WatchDirectoryArgs = {
  path: string;
  // Signals that something under the directory changed, without saying what:
  // callers re-read whatever they care about and compare.
  // TODO: Make this event more precise regarding what changed.
  onChange: () => void;
  ignoredTopLevelEntries?: string[];
};

export type DirectoryWatcher = {
  watchDirectory: (args: WatchDirectoryArgs) => void;
  unwatchDirectory: (path: string) => void;
  unwatchAllDirectories: () => void;
};
