import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';
import { vi } from 'vitest';

import { type DocumentAnalyzer } from '../../../../../domain/rich-text';
import { type Filesystem } from '../../../../../infrastructure/filesystem';
import { type ProjectId } from '../../../models';
import { createAdapter } from './index';

export const PROJECT_PATH = '/projects/my-project' as ProjectId;

export const mockListDirectoryFiles = vi.fn();
export const mockGetAbsolutePath = vi.fn();
export const mockReadTextFile = vi.fn();
export const mockWriteFile = vi.fn();
export const mockDeleteFile = vi.fn();
export const mockExists = vi.fn();
export const mockEnsureDirectory = vi.fn();

export const mockFilesystem: Partial<Filesystem> = {
  listDirectoryFiles: mockListDirectoryFiles,
  getAbsolutePath: mockGetAbsolutePath,
  readTextFile: mockReadTextFile,
  writeFile: mockWriteFile,
  deleteFile: mockDeleteFile,
  exists: mockExists,
  ensureDirectory: mockEnsureDirectory,
};

export const mockExtractLocalAssetReferences = vi.fn();
export const mockDocumentAnalyzer: DocumentAnalyzer = {
  extractLocalAssetReferences: mockExtractLocalAssetReferences,
};

// Builds the fully composed store. Each test file supplies its own hoisted
// vi.mock of version-control / isomorphic-git, which applies transitively here.
export const buildTestStore = () =>
  createAdapter({
    isoGitFs: {} as IsoGitFsApi,
    filesystem: mockFilesystem as Filesystem,
    isoGitHttp: {} as IsoGitHttpApi,
    documentAnalyzer: mockDocumentAnalyzer,
    managesFilesystemWorkdir: true,
  });
