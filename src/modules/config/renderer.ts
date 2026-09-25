import { buildConfig } from './build';
import { type RendererConfig } from './types';

export const resolveRendererConfig = ({
  syncServiceUrl,
}: {
  syncServiceUrl?: string;
}): RendererConfig => ({
  primaryRichTextRepresentation: buildConfig.primaryRichTextRepresentation,
  syncServiceUrl: syncServiceUrl ?? buildConfig.syncServiceUrl,
});
