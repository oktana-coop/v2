import { type MemFS } from '@wasmer/wasi';

import { type WasiFile } from '../../../ports/wasm';
import { toPosixSegments } from './posix-path';

// Ancestor dirs of a path, shallowest first: `/a/b/c.txt` -> [`/a`, `/a/b`].
export const ancestorDirs = (path: string): ReadonlyArray<string> => {
  const dirSegments = toPosixSegments(path).slice(0, -1);
  return dirSegments.map((_, i) => `/${dirSegments.slice(0, i + 1).join('/')}`);
};

const createDirIfMissing = (fs: MemFS, dir: string): void => {
  try {
    fs.createDir(dir);
  } catch {
    // Already exists — ignore.
  }
};

// Writes the files into the in-memory filesystem, creating parent dirs.
export const writeFilesToMemFS = ({
  fs,
  files,
}: {
  fs: MemFS;
  files: ReadonlyArray<WasiFile>;
}): void => {
  for (const { path, bytes } of files) {
    for (const dir of ancestorDirs(path)) {
      createDirIfMissing(fs, dir);
    }
    const guestPath = `/${toPosixSegments(path).join('/')}`;
    fs.open(guestPath, { write: true, create: true }).write(bytes);
  }
};
