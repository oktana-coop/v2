import { next as Automerge } from '@automerge/automerge/slim';

import {
  type VersionedArtifact,
  type VersionedArtifactHandle,
  versionedArtifactTypes,
} from '../../../../modules/infrastructure/version-control';
import { sortKeysAndStrinfigy } from '../../../../utils/object';

export type RichTextDocumentSpan = Automerge.Span;

export type RichTextDocument = {
  type: typeof versionedArtifactTypes.RICH_TEXT_DOCUMENT;
  content: string;
};

export type VersionedDocument = VersionedArtifact<RichTextDocument>;

export type VersionedDocumentHandle = VersionedArtifactHandle<RichTextDocument>;

export const getSpans: (
  document: VersionedDocument
) => Array<RichTextDocumentSpan> = (document) => {
  return Automerge.spans(document, ['content']);
};

export const getSpansString = (document: VersionedDocument) => {
  const spans = getSpans(document);
  return sortKeysAndStrinfigy(spans);
};

export const convertToStorageFormat = getSpansString;

export const isEmpty = (document: VersionedDocument): boolean => {
  return document.content === '';
};
