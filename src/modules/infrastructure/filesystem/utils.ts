// Functions in this module mostly work for POSIX paths.
// TODO: Improve implementations so that they also work on Windows.

export const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, '');
};

export const getExtension = (filename: string) => {
  const match = filename.match(/\.([^./\\]+)$/);
  return match ? match[1] : '';
};

export const removePath = (filepath: string) => {
  // Split on both / and \ to support POSIX and Windows paths.
  const parts = filepath.split(/[/\\]/);
  return parts[parts.length - 1];
};

export const getParentPath = (filepath: string) => {
  // Find the last path separator (/ or \) by matching a separator
  // followed by any non-separator characters until the end of the string.
  const lastSep = filepath.search(/[/\\][^/\\]*$/);
  return lastSep > 0 ? filepath.slice(0, lastSep) : '';
};

export const getDirectoryName = (dirPath: string) => {
  // Remove trailing slash and then split.
  const parts = dirPath.replace(/\/$/, '').split('/');
  return parts[parts.length - 1];
};
