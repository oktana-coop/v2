import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { WasiFile } from '../../ports/wasm';

// Writes the files into a fresh temp dir (mirroring their guest paths) and returns it.
export const writeFilesToTempDir = async (
  files: ReadonlyArray<WasiFile>
): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'wasi-files-'));

  await Promise.all(
    files.map(async ({ path, bytes }) => {
      const dest = join(dir, path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
    })
  );

  return dir;
};
