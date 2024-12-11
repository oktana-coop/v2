import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { BrowserWindow } from 'electron';

import type { Filesystem } from '../../../filesystem';
import { createAdapter as createAutomergeVersionControlAdapter } from '../../adapters/automerge';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../commands';
import { isValidVersionControlId, type VersionControlId } from '../../models';
import { setup as setupNodeRepo } from './setup';

const openProject = async ({
  projectId,
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  projectId: VersionControlId;
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<void> => {
  // Setup the version control repository
  const automergeRepo = await setupNodeRepo({
    processId: 'main',
    directoryPath: join(directoryPath, '.v2', 'automerge'),
    renderers: new Map([[rendererProcessId, browserWindow]]),
  });

  const versionControlRepo =
    createAutomergeVersionControlAdapter(automergeRepo);

  await updateProjectFromFilesystemContent({
    createDocument: versionControlRepo.createDocument,
    listProjectDocuments: versionControlRepo.listProjectDocuments,
    findDocumentInProject: versionControlRepo.findDocumentInProject,
    deleteDocumentFromProject: versionControlRepo.deleteDocumentFromProject,
    updateDocumentSpans: versionControlRepo.updateDocumentSpans,
    listDirectoryFiles: listDirectoryFiles,
    readFile: readFile,
  })({ projectId, directoryPath });
};

const openProjectFromFilesystem = async ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<VersionControlId> => {
  // Check if the directory exists
  await fs.access(directoryPath);

  const indexFilePath = join(directoryPath, '.v2', 'index.txt');
  // The only thing the index file should contain is the project ID.
  const { content: projectId } = await readFile(indexFilePath);

  if (!projectId || !isValidVersionControlId(projectId)) {
    throw new Error('Project ID in the filesystem repo is invalid');
  }

  await openProject({
    projectId,
    directoryPath,
    rendererProcessId,
    browserWindow,
    listDirectoryFiles,
    readFile,
  });

  return projectId;
};

export const openProjectById = async ({
  projectId,
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  projectId: VersionControlId;
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<void> => {
  // Check if the directory exists
  await fs.access(directoryPath);

  const indexFilePath = join(directoryPath, '.v2', 'index.txt');
  // The only thing the index file should contain is the project ID.
  const { content: filesystemProjectId } = await readFile(indexFilePath);

  if (!filesystemProjectId || !isValidVersionControlId(filesystemProjectId)) {
    throw new Error('Project ID in the filesystem repo is invalid');
  }

  if (filesystemProjectId !== projectId) {
    throw new Error(
      'The project ID in the filesystem is different than the one the app is trying to open'
    );
  }

  await openProject({
    projectId,
    directoryPath,
    rendererProcessId,
    browserWindow,
    listDirectoryFiles,
    readFile,
  });
};

const createNewProject = async ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<VersionControlId> => {
  // Setup the version control repository
  const automergeRepo = await setupNodeRepo({
    processId: 'main',
    directoryPath: join(directoryPath, '.v2', 'automerge'),
    renderers: new Map([[rendererProcessId, browserWindow]]),
  });

  const versionControlRepo =
    createAutomergeVersionControlAdapter(automergeRepo);

  const projectId = await createProjectFromFilesystemContent({
    createProject: versionControlRepo.createProject,
    createDocument: versionControlRepo.createDocument,
    listDirectoryFiles: listDirectoryFiles,
    readFile: readFile,
  })({ directoryPath });

  const indexFilePath = join(directoryPath, '.v2', 'index.txt');
  await fs.writeFile(indexFilePath, projectId, 'utf8');

  return projectId;
};

export const openOrCreateProject = async ({
  directoryPath,
  rendererProcessId,
  browserWindow,
  listDirectoryFiles,
  readFile,
}: {
  directoryPath: string;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
}): Promise<VersionControlId> => {
  try {
    const projectId = await openProjectFromFilesystem({
      directoryPath,
      rendererProcessId,
      browserWindow,
      listDirectoryFiles,
      readFile,
    });

    return projectId;
  } catch (err) {
    // Directory or index file does not exist; create a new repo & project
    return createNewProject({
      directoryPath,
      rendererProcessId,
      browserWindow,
      listDirectoryFiles,
      readFile,
    });
  }
};
