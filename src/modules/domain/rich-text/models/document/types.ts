import {
  type ResolvedArtifact,
  type ResolvedArtifactId,
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { type TextRichTextRepresentation } from '../../constants';

export const CURRENT_SCHEMA_VERSION = 1;

export type RichTextDocument = {
  type: typeof versionedArtifactTypes.RICH_TEXT_DOCUMENT;
  schemaVersion: number;
  representation: TextRichTextRepresentation;
  content: string;
};

export type VersionedDocument = VersionedArtifact<RichTextDocument>;

export type ResolvedDocument = ResolvedArtifact<
  ResolvedArtifactId,
  RichTextDocument
>;

export type VersionedDocumentHandle = VersionedArtifactHandle<RichTextDocument>;
