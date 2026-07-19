import {
  type ArtifactId,
  type ResolvedArtifact,
  type VersionedArtifact,
} from '../../../../../modules/infrastructure/version-control';
import { type TextRichTextRepresentation } from '../representation';

export const CURRENT_SCHEMA_VERSION = 1;

export type RichTextDocument = {
  schemaVersion: number;
  representation: TextRichTextRepresentation;
  content: string;
};

export type VersionedDocument = VersionedArtifact<RichTextDocument>;

export type ResolvedDocument = ResolvedArtifact<ArtifactId, RichTextDocument>;
