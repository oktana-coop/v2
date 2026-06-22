import { BuildConfig } from './types';

export const buildConfig: BuildConfig = {
  useHistoryWorker:
    import.meta.env.VITE_USE_HISTORY_WORKER === 'true' ? true : false,
  primaryRichTextRepresentation: import.meta.env
    .VITE_PRIMARY_RICH_TEXT_REPRESENTATION as BuildConfig['primaryRichTextRepresentation'],
  multiDocumentProjectVersionControlSystem: import.meta.env
    .VITE_MULTI_DOCUMENT_PROJECT_VCS as BuildConfig['multiDocumentProjectVersionControlSystem'],
  githubAppClientId: import.meta.env
    .VITE_GITHUB_APP_CLIENT_ID as BuildConfig['githubAppClientId'],
};
