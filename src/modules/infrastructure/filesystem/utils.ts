// Functions in this module mostly work for POSIX paths.
// TODO: Improve implementations so that they also work on Windows.

export const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, '');
};

export const getExtension = (filename: string) => {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1] : '';
};

export const removePath = (filepath: string) => {
  const parts = filepath.split('/');

  const [filename] = parts.slice(-1);

  return filename;
};

export const getDirectoryName = (dirPath: string) => {
  // Remove trailing slash and then split.
  const parts = dirPath.replace(/\/$/, '').split('/');
  return parts[parts.length - 1];
};
