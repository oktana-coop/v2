import { BuildConfig } from './types';

export const buildConfig: BuildConfig = {
  primaryRichTextRepresentation: import.meta.env
    .VITE_PRIMARY_RICH_TEXT_REPRESENTATION as BuildConfig['primaryRichTextRepresentation'],
  githubAppClientId: import.meta.env
    .VITE_GITHUB_APP_CLIENT_ID as BuildConfig['githubAppClientId'],
};
