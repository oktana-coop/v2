import { basename, sep } from 'path';

export const pathContainsHiddenEntries = (p: string): boolean =>
  p
    .split(sep)
    .some(
      (segment) =>
        segment !== '' &&
        segment !== '.' &&
        segment !== '..' &&
        isHidden(segment)
    );

export const isHidden = (path: string): boolean => {
  // Check if the file starts with a dot (for macOS/Linux)
  if (basename(path).startsWith('.')) {
    return true;
  }

  // TODO: handle Windows hidden files

  return false;
};

export const isNodeError = (err: unknown): err is NodeJS.ErrnoException => {
  return err instanceof Error && 'code' in err;
};
