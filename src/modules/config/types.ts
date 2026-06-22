import { type TextRichTextRepresentation } from '../domain/rich-text';
import { type VersionControlSystem } from '../infrastructure/version-control';

export type BuildConfig = {
  useHistoryWorker: boolean;
  primaryRichTextRepresentation: TextRichTextRepresentation;
  multiDocumentProjectVersionControlSystem: VersionControlSystem;
  githubAppClientId: string;
};

// Explicitly pick only the config values we want to expose to the renderer process
export type RendererConfig = Pick<
  BuildConfig,
  | 'useHistoryWorker'
  | 'primaryRichTextRepresentation'
  | 'multiDocumentProjectVersionControlSystem'
>;
