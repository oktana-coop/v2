import * as Effect from 'effect/Effect';

import {
  DataIntegrityError as FilesystemDataIntegrityError,
  type File,
  type Filesystem,
  filesystemItemTypes,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
  toDirectory,
} from '../../../../../infrastructure/filesystem';
import { createGitBlobRef } from '../../../../../infrastructure/version-control';
import {
  NotFoundError,
  RepositoryError,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
} from '../../../errors';
import { parseProjectRelPath, type ProjectId } from '../../../models';
import { type ProjectStore } from '../../../ports';
import { createDirectoryOps } from './directories';

const projectId = '/projects/my-project' as ProjectId;

const mockGetAbsolutePath = vi.fn();
const mockCreateDirectory = vi.fn();
const mockListDirectoryFiles = vi.fn();
const mockGetRelativePath = vi.fn();
const mockDeleteDirectory = vi.fn();
const mockFindDocumentByPath = vi.fn();
const mockDeleteDocuments = vi.fn();

const filesystem: Partial<Filesystem> = {
  getAbsolutePath: mockGetAbsolutePath,
  createDirectory: mockCreateDirectory,
  listDirectoryFiles: mockListDirectoryFiles,
  getRelativePath: mockGetRelativePath,
  deleteDirectory: mockDeleteDirectory,
};

const documentOps: Pick<
  ProjectStore,
  'findDocumentByPath' | 'deleteDocuments'
> = {
  findDocumentByPath: mockFindDocumentByPath,
  deleteDocuments: mockDeleteDocuments,
};

const ops = createDirectoryOps({
  filesystem: filesystem as Filesystem,
  documentOps,
});

const fileNode = (path: string, name: string): File => ({
  type: filesystemItemTypes.FILE,
  path,
  name,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAbsolutePath.mockImplementation(({ path, dirPath }) =>
    Effect.succeed(`${dirPath}/${path}`)
  );
  mockGetRelativePath.mockImplementation(({ path, relativeTo }) =>
    Effect.succeed(path.slice(`${relativeTo}/`.length))
  );
});

describe('createDirectory', () => {
  it('creates a directory at the project root when no parent is given', async () => {
    mockCreateDirectory.mockReturnValue(Effect.void);

    await Effect.runPromise(ops.createDirectory({ projectId, name: 'newdir' }));

    expect(mockGetAbsolutePath).not.toHaveBeenCalled();
    expect(mockCreateDirectory).toHaveBeenCalledWith({
      name: 'newdir',
      parentDirectory: toDirectory({ path: projectId }),
    });
  });

  it('resolves the parent directory and creates the folder under it', async () => {
    mockCreateDirectory.mockReturnValue(Effect.void);

    await Effect.runPromise(
      ops.createDirectory({
        projectId,
        parentDirectoryPath: parseProjectRelPath('notes'),
        name: 'sub',
      })
    );

    expect(mockGetAbsolutePath).toHaveBeenCalledWith({
      path: 'notes',
      dirPath: projectId,
    });
    expect(mockCreateDirectory).toHaveBeenCalledWith({
      name: 'sub',
      parentDirectory: toDirectory({ path: `${projectId}/notes` }),
    });
  });

  it('maps a filesystem NotFoundError to a domain NotFoundError', async () => {
    mockCreateDirectory.mockReturnValue(
      Effect.fail(new FilesystemNotFoundError('missing parent'))
    );

    const result = await Effect.runPromise(
      Effect.either(ops.createDirectory({ projectId, name: 'x' }))
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectNotFoundErrorTag);
    }
  });

  it('maps a filesystem RepositoryError to a domain RepositoryError', async () => {
    mockCreateDirectory.mockReturnValue(
      Effect.fail(new FilesystemRepositoryError('io error'))
    );

    const result = await Effect.runPromise(
      Effect.either(ops.createDirectory({ projectId, name: 'x' }))
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectRepositoryErrorTag);
    }
  });
});

describe('deleteDirectory', () => {
  const directoryPath = parseProjectRelPath('docs');

  it('deletes the tracked documents inside the directory', async () => {
    mockListDirectoryFiles.mockReturnValue(
      Effect.succeed([
        fileNode(`${projectId}/docs/a.md`, 'a.md'),
        fileNode(`${projectId}/docs/b.md`, 'b.md'),
      ])
    );
    mockFindDocumentByPath.mockImplementation(({ documentPath }) =>
      Effect.succeed({
        id: createGitBlobRef({ ref: 'main', path: documentPath }),
      })
    );
    mockDeleteDocuments.mockReturnValue(Effect.void);

    await Effect.runPromise(ops.deleteDirectory({ projectId, directoryPath }));

    expect(mockDeleteDocuments).toHaveBeenCalledWith({
      documentIds: [
        createGitBlobRef({ ref: 'main', path: 'docs/a.md' }),
        createGitBlobRef({ ref: 'main', path: 'docs/b.md' }),
      ],
      projectId,
      deleteFromFilesystem: true,
      directoryPath: `${projectId}/docs`,
    });
    expect(mockDeleteDirectory).not.toHaveBeenCalled();
  });

  it('removes an empty directory directly when it has no tracked documents', async () => {
    mockListDirectoryFiles.mockReturnValue(Effect.succeed([]));
    mockDeleteDirectory.mockReturnValue(Effect.void);

    await Effect.runPromise(ops.deleteDirectory({ projectId, directoryPath }));

    expect(mockDeleteDirectory).toHaveBeenCalledWith({
      path: `${projectId}/docs`,
    });
    expect(mockDeleteDocuments).not.toHaveBeenCalled();
  });

  it('skips untracked files and removes the directory directly', async () => {
    mockListDirectoryFiles.mockReturnValue(
      Effect.succeed([
        fileNode(`${projectId}/docs/untracked.md`, 'untracked.md'),
      ])
    );
    // Untracked file — the lookup reports not-found and is silently skipped.
    mockFindDocumentByPath.mockReturnValue(
      Effect.fail(new NotFoundError('Document is ignored or absent'))
    );
    mockDeleteDirectory.mockReturnValue(Effect.void);

    await Effect.runPromise(ops.deleteDirectory({ projectId, directoryPath }));

    expect(mockDeleteDirectory).toHaveBeenCalledWith({
      path: `${projectId}/docs`,
    });
    expect(mockDeleteDocuments).not.toHaveBeenCalled();
  });

  it('aborts the delete when a tracked-document lookup errors', async () => {
    mockListDirectoryFiles.mockReturnValue(
      Effect.succeed([fileNode(`${projectId}/docs/a.md`, 'a.md')])
    );
    // A real lookup failure (not a not-found) must not be treated as
    // "untracked" — otherwise the folder, including the tracked file, would be
    // removed from disk without staging its git removal.
    mockFindDocumentByPath.mockReturnValue(
      Effect.fail(new RepositoryError('git index unreadable'))
    );
    mockDeleteDirectory.mockReturnValue(Effect.void);

    const result = await Effect.runPromise(
      Effect.either(ops.deleteDirectory({ projectId, directoryPath }))
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectRepositoryErrorTag);
    }
    expect(mockDeleteDirectory).not.toHaveBeenCalled();
    expect(mockDeleteDocuments).not.toHaveBeenCalled();
  });

  it('maps a directory-listing DataIntegrityError to a RepositoryError', async () => {
    mockListDirectoryFiles.mockReturnValue(
      Effect.fail(new FilesystemDataIntegrityError('corrupt listing'))
    );

    const result = await Effect.runPromise(
      Effect.either(ops.deleteDirectory({ projectId, directoryPath }))
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectRepositoryErrorTag);
    }
  });
});
