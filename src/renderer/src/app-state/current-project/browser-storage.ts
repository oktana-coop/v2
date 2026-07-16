import { type ProjectId } from '../../../../modules/domain/project';
import { type Directory } from '../../../../modules/infrastructure/filesystem';

export const PROJECT_BROWSER_STORAGE_KEY = 'project';

// Where the last opened project lives. Project ids are opaque, so the directory
// path has to be remembered alongside the id.
export type BrowserStorageProjectData = {
  projectId: ProjectId;
  directoryPath: Directory['path'];
};

export const readStoredProject = (): BrowserStorageProjectData | null => {
  const stored = localStorage.getItem(PROJECT_BROWSER_STORAGE_KEY);

  if (!stored) return null;

  try {
    return JSON.parse(stored) as BrowserStorageProjectData;
  } catch {
    return null;
  }
};

export const storeProject = (project: BrowserStorageProjectData) =>
  localStorage.setItem(PROJECT_BROWSER_STORAGE_KEY, JSON.stringify(project));
