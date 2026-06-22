import { type ProjectId } from '../../../../modules/domain/project';
import { type Directory } from '../../../../modules/infrastructure/filesystem';

export const MULTI_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY =
  'multi-document-project';

export type MultiDocumentBrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  projectId: ProjectId;
};

export type BrowserStorageProjectData = MultiDocumentBrowserStorageProjectData;
