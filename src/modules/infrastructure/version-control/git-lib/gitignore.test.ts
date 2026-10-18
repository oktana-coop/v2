import * as Effect from 'effect/Effect';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';
import path from 'path';

import { writeGitignoreIfMissing } from './gitignore';

const dir = '/test-repo';
const mockStat = vi.fn();
const mockWriteFile = vi.fn();
const mockFs = {
  promises: { stat: mockStat, writeFile: mockWriteFile },
} as unknown as IsoGitFsApi;

const fsError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('writeGitignoreIfMissing', () => {
  it('writes the default gitignore when the folder has none', async () => {
    mockStat.mockRejectedValue(fsError('ENOENT'));
    mockWriteFile.mockResolvedValue(undefined);

    await Effect.runPromise(writeGitignoreIfMissing({ isoGitFs: mockFs, dir }));

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writtenPath, contents] = mockWriteFile.mock.calls[0];
    expect(writtenPath).toBe(path.join(dir, '.gitignore'));
    expect(contents).toContain('.DS_Store');
  });

  it('leaves an existing gitignore alone', async () => {
    mockStat.mockResolvedValue({ isFile: () => true });

    await Effect.runPromise(writeGitignoreIfMissing({ isoGitFs: mockFs, dir }));

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('fails with RepositoryError when the write fails', async () => {
    mockStat.mockRejectedValue(fsError('ENOENT'));
    mockWriteFile.mockRejectedValue(new Error('write failed'));

    const error = await Effect.runPromise(
      Effect.flip(writeGitignoreIfMissing({ isoGitFs: mockFs, dir }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });

  // Writing over a gitignore we merely failed to read would destroy it.
  it('fails without writing when the existing gitignore cannot be read', async () => {
    mockStat.mockRejectedValue(fsError('EACCES'));

    const error = await Effect.runPromise(
      Effect.flip(writeGitignoreIfMissing({ isoGitFs: mockFs, dir }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
