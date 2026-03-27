import { type ProjectId } from '../../../../modules/domain/project';
import {
  type Directory,
  type File,
} from '../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../modules/infrastructure/version-control';

export const MULTI_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY =
  'multi-document-project';
export const SINGLE_DOCUMENT_PROJECT_BROWSER_STORAGE_KEY =
  'single-document-project';

export type MultiDocumentBrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  projectId: ProjectId;
};

export type SingleDocumentBrowserStorageProjectData = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  file: File | null;
};

export type BrowserStorageProjectData =
  | MultiDocumentBrowserStorageProjectData
  | SingleDocumentBrowserStorageProjectData;
