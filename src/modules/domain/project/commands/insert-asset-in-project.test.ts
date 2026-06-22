import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import {
  AbortError,
  type BinaryFile,
  type File,
  filesystemItemTypes,
} from '../../../../modules/infrastructure/filesystem';
import { NotFoundError as VersionedProjectNotFoundError } from '../errors';
import { parseProjectId, type ProjectId } from '../models';
import {
  insertAssetInProject,
  type InsertAssetInProjectDeps,
} from './insert-asset-in-project';

const PROJECT_ROOT = '/tmp/v2-test-project';
const projectId: ProjectId = parseProjectId(PROJECT_ROOT);

const alreadyInProjectAt = (relPath: string) =>
  vi.fn().mockReturnValue(Effect.succeed(relPath));
const outsideProject = () => vi.fn().mockReturnValue(Effect.succeed(null));

const fileAt = (path: string): File => ({
  type: filesystemItemTypes.FILE,
  name: path.split('/').pop() ?? path,
  path,
});

const buildDeps = (
  overrides: Partial<InsertAssetInProjectDeps> & {
    pickedFilePath?: string;
  } = {}
): InsertAssetInProjectDeps & {
  openFile: ReturnType<typeof vi.fn>;
  readBinaryFile: ReturnType<typeof vi.fn>;
  lookupAssetByName: ReturnType<typeof vi.fn>;
  addAssetToProject: ReturnType<typeof vi.fn>;
} => {
  const openFile =
    overrides.openFile ??
    vi
      .fn()
      .mockReturnValue(
        Effect.succeed(
          fileAt(overrides.pickedFilePath ?? '/tmp/elsewhere/pic.jpg')
        )
      );
  const readBinaryFile =
    overrides.readBinaryFile ??
    vi.fn().mockImplementation((path: string) =>
      Effect.succeed({
        type: filesystemItemTypes.FILE,
        name: path.split('/').pop() ?? path,
        path,
        content: new Uint8Array([1, 2, 3]),
      } satisfies BinaryFile)
    );
  // Default: every lookup raises NotFoundError (no existing asset, so no
  // collision and the desired name is accepted).
  const lookupAssetByName =
    overrides.lookupAssetByName ??
    vi
      .fn()
      .mockReturnValue(
        Effect.fail(new VersionedProjectNotFoundError('no such asset'))
      );
  const addAssetToProject =
    overrides.addAssetToProject ??
    vi.fn().mockImplementation(() => Effect.succeed('aid'));
  // Default: the source isn't inside the project, so no reuse. Tests
  // exercising the reuse branch override with `alreadyInProjectAt('...')`.
  const getProjectRelativePath =
    overrides.getProjectRelativePath ?? outsideProject();
  return {
    openFile,
    readBinaryFile,
    lookupAssetByName,
    addAssetToProject,
    getProjectRelativePath,
    assetsDirName: overrides.assetsDirName ?? 'assets',
  } as unknown as InsertAssetInProjectDeps & {
    openFile: ReturnType<typeof vi.fn>;
    readBinaryFile: ReturnType<typeof vi.fn>;
    lookupAssetByName: ReturnType<typeof vi.fn>;
    addAssetToProject: ReturnType<typeof vi.fn>;
  };
};

describe('insertAssetInProject', () => {
  it('reuses an existing asset when the source is already in the assets folder', async () => {
    const deps = buildDeps({
      pickedFilePath: `${PROJECT_ROOT}/assets/photo.jpg`,
      getProjectRelativePath: alreadyInProjectAt('assets/photo.jpg'),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.getOrNull(result)).toEqual({
      relPath: 'assets/photo.jpg',
    });
    expect(deps.openFile).toHaveBeenCalledOnce();
    expect(deps.readBinaryFile).not.toHaveBeenCalled();
    expect(deps.addAssetToProject).not.toHaveBeenCalled();
    expect(deps.lookupAssetByName).not.toHaveBeenCalled();
  });

  it('reuses an existing asset in a nested subfolder of assets', async () => {
    const deps = buildDeps({
      pickedFilePath: `${PROJECT_ROOT}/assets/2024/photo.jpg`,
      getProjectRelativePath: alreadyInProjectAt('assets/2024/photo.jpg'),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.getOrNull(result)).toEqual({
      relPath: 'assets/2024/photo.jpg',
    });
    expect(deps.addAssetToProject).not.toHaveBeenCalled();
  });

  it('does not reuse when the source is outside the project', async () => {
    const deps = buildDeps({ pickedFilePath: '/tmp/elsewhere/pic.jpg' });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(deps.readBinaryFile).toHaveBeenCalledWith('/tmp/elsewhere/pic.jpg');
    expect(deps.addAssetToProject).toHaveBeenCalledOnce();
    expect(Option.getOrNull(result)?.relPath).toBe('assets/pic.jpg');
  });

  it('reuses any file already inside the project, even outside the assets folder', async () => {
    const deps = buildDeps({
      pickedFilePath: `${PROJECT_ROOT}/notes/pic.jpg`,
      getProjectRelativePath: alreadyInProjectAt('notes/pic.jpg'),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.getOrNull(result)).toEqual({
      relPath: 'notes/pic.jpg',
    });
    expect(deps.readBinaryFile).not.toHaveBeenCalled();
    expect(deps.addAssetToProject).not.toHaveBeenCalled();
  });

  it('reuses a file at the project root', async () => {
    const deps = buildDeps({
      pickedFilePath: `${PROJECT_ROOT}/photo.jpg`,
      getProjectRelativePath: alreadyInProjectAt('photo.jpg'),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.getOrNull(result)).toEqual({
      relPath: 'photo.jpg',
    });
    expect(deps.addAssetToProject).not.toHaveBeenCalled();
  });

  it('copies and collision-suffixes when an asset with the same name already exists in the folder', async () => {
    const deps = buildDeps({
      pickedFilePath: '/tmp/elsewhere/pic.jpg',
      lookupAssetByName: vi
        .fn()
        // First name "pic.jpg" exists → recurse with suffix.
        .mockImplementationOnce(() => Effect.succeed('existing-id'))
        // Second name "pic-1.jpg" doesn't exist → accept.
        .mockImplementationOnce(() =>
          Effect.fail(new VersionedProjectNotFoundError('no such asset'))
        ),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.getOrNull(result)?.relPath).toBe('assets/pic-1.jpg');
    expect(deps.addAssetToProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'pic-1.jpg' })
    );
  });

  it('returns none when the user cancels the file picker', async () => {
    const deps = buildDeps({
      openFile: vi
        .fn()
        .mockReturnValue(Effect.fail(new AbortError('cancelled'))),
    });
    const result = await Effect.runPromise(
      insertAssetInProject(deps)({ projectId })
    );
    expect(Option.isNone(result)).toBe(true);
    expect(deps.readBinaryFile).not.toHaveBeenCalled();
    expect(deps.addAssetToProject).not.toHaveBeenCalled();
  });
});
