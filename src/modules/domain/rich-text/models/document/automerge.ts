import { next as Automerge } from '@automerge/automerge/slim';

import { sortKeysAndStrinfigy } from '../../../../../utils/object';
import { type VersionedDocument } from '../document';

export type RichTextDocumentSpan = Automerge.Span;

export const getSpans: (
  document: VersionedDocument
) => Array<RichTextDocumentSpan> = (document) => {
  return Automerge.spans(document, ['content']);
};

export const getSpansString = (document: VersionedDocument) => {
  const spans = getSpans(document);
  return sortKeysAndStrinfigy(spans);
};
