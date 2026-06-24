import { type TextRichTextRepresentation } from '../domain/rich-text';

export type BuildConfig = {
  primaryRichTextRepresentation: TextRichTextRepresentation;
  githubAppClientId: string;
};

// Explicitly pick only the config values we want to expose to the renderer process
export type RendererConfig = Pick<BuildConfig, 'primaryRichTextRepresentation'>;
