export type WatchDirectoryArgs = {
  path: string;
  onChange: () => void;
  ignoredTopLevelEntries?: string[];
};

export type DirectoryWatcher = {
  watchDirectory: (args: WatchDirectoryArgs) => void;
  unwatchDirectory: (path: string) => void;
  unwatchAllDirectories: () => void;
};
