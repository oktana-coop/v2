import { BuildConfig } from './types';

export const buildConfig: BuildConfig = {
  useHistoryWorker:
    import.meta.env.VITE_USE_HISTORY_WORKER === 'true' ? true : false,
  singleDocumentProjectVersionControlSystem: import.meta.env
    .SINGLE_DOCUMENT_PROJECT_VCS as BuildConfig['singleDocumentProjectVersionControlSystem'],
  multiDocumentProjectVersionControlSystem: import.meta.env
    .MULTI_DOCUMENT_PROJECT_VCS as BuildConfig['multiDocumentProjectVersionControlSystem'],
};
