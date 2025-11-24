import { buildConfig } from './build';
import { type RendererConfig } from './types';

export * from './types';

export const config: RendererConfig = {
  useHistoryWorker: buildConfig.useHistoryWorker,
  primaryRichTextRepresentation: buildConfig.primaryRichTextRepresentation,
  singleDocumentProjectVersionControlSystem:
    buildConfig.singleDocumentProjectVersionControlSystem,
  multiDocumentProjectVersionControlSystem:
    buildConfig.multiDocumentProjectVersionControlSystem,
  projectType: buildConfig.projectType,
};
