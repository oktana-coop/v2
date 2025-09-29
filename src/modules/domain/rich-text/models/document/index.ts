import {
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { type TextRichTextRepresentation } from '../../constants';

export type RichTextDocument = {
  type: typeof versionedArtifactTypes.RICH_TEXT_DOCUMENT;
  representation: TextRichTextRepresentation;
  content: string;
};

export type VersionedDocument = VersionedArtifact<RichTextDocument>;

export type VersionedDocumentHandle = VersionedArtifactHandle<RichTextDocument>;

export const isEmpty = (document: VersionedDocument): boolean => {
  return document.content === '';
};
