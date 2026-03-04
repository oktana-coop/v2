import { basename } from 'path';

export const isHidden = (path: string): boolean => {
  // Check if the file starts with a dot (for macOS/Linux)
  if (basename(path).startsWith('.')) {
    return true;
  }

  // TODO: handle Windows hidden files

  return false;
};
