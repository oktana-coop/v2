import { type ProjectType } from '../domain/project';
import { type RichTextRepresentation } from '../domain/rich-text';
import { type VersionControlSystem } from '../infrastructure/version-control';

export type BuildConfig = {
  useHistoryWorker: boolean;
  primaryRichTextRepresentation: RichTextRepresentation;
  singleDocumentProjectVersionControlSystem: VersionControlSystem;
  multiDocumentProjectVersionControlSystem: VersionControlSystem;
  projectType: ProjectType;
};

// Explicitly pick only the config values we want to expose to the renderer process
export type RendererConfig = Pick<
  BuildConfig,
  | 'useHistoryWorker'
  | 'primaryRichTextRepresentation'
  | 'singleDocumentProjectVersionControlSystem'
  | 'multiDocumentProjectVersionControlSystem'
  | 'projectType'
>;
