import { BuildConfig } from './types';

export const buildConfig: BuildConfig = {
  useHistoryWorker:
    import.meta.env.VITE_USE_HISTORY_WORKER === 'true' ? true : false,
  primaryRichTextRepresentation: import.meta.env
    .VITE_PRIMARY_RICH_TEXT_REPRESENTATION as BuildConfig['primaryRichTextRepresentation'],
  singleDocumentProjectVersionControlSystem: import.meta.env
    .VITE_SINGLE_DOCUMENT_PROJECT_VCS as BuildConfig['singleDocumentProjectVersionControlSystem'],
  multiDocumentProjectVersionControlSystem: import.meta.env
    .VITE_MULTI_DOCUMENT_PROJECT_VCS as BuildConfig['multiDocumentProjectVersionControlSystem'],
  projectType: import.meta.env.VITE_PROJECT_TYPE as BuildConfig['projectType'],
};
