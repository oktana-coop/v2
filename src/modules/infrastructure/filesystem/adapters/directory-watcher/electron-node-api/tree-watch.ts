// Watching a directory and everything under it, whichever way the platform
// needs it done.
export type WatchTreeArgs = {
  path: string;
  // The entry relative to `path`, in the platform's separators, or null when
  // Node does not name it.
  onEvent: (filename: string | null) => void;
  // The watched directory itself can no longer be watched.
  onError: () => void;
};

export type CloseTreeWatch = () => void;

export type WatchTree = (args: WatchTreeArgs) => CloseTreeWatch;
