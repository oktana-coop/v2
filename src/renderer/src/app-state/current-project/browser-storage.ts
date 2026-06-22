import { type ProjectId } from '../../../../modules/domain/project';
import { type Directory } from '../../../../modules/infrastructure/filesystem';

export const PROJECT_BROWSER_STORAGE_KEY = 'project';

export type BrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  projectId: ProjectId;
};
