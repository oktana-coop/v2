// @vitest-environment node
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

import type { WasiFile } from '../../ports/wasm';
import { writeFilesToTempDir } from './ephemeral-wasi-files';

describe('writeFilesToTempDir', () => {
  // A temp dir with the given files; its cleanup is registered with the running test.
  const tempDirWith = async (files: ReadonlyArray<WasiFile>) => {
    const dir = await writeFilesToTempDir(files);
    onTestFinished(() => rm(dir, { recursive: true, force: true }));
    return dir;
  };

  const readBytes = async ({
    dir,
    path,
  }: {
    dir: string;
    path: string;
  }): Promise<Uint8Array> => new Uint8Array(await readFile(join(dir, path)));

  it('writes each file under the temp dir, mirroring its absolute guest path', async () => {
    const files = [
      { path: '/config.json', bytes: new Uint8Array([1, 2, 3]) },
      { path: '/lib/shared/strings.txt', bytes: new Uint8Array([4, 5]) },
    ];

    const dir = await tempDirWith(files);

    for (const file of files) {
      const tempFileBytes = await readBytes({ dir, path: file.path });
      expect(tempFileBytes).toEqual(file.bytes);
    }
  });

  it('returns an empty directory when given no files', async () => {
    const dir = await tempDirWith([]);

    expect(await readdir(dir)).toEqual([]);
  });
});
