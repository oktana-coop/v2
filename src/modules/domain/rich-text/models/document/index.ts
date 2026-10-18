import { richTextRepresentations } from '../representation';
import { getSpansString } from './automerge';
import { type RichTextDocument, type VersionedDocument } from './types';

export const isEmpty = (document: VersionedDocument): boolean => {
  return document.content === '';
};

// The schema version shapes the record, not what the document says.
export const richTextDocumentsAreEqual = (
  a: RichTextDocument,
  b: RichTextDocument
): boolean => a.representation === b.representation && a.content === b.content;

export const getDocumentRichTextContent = (
  document: RichTextDocument
): string => {
  return document.representation === richTextRepresentations.AUTOMERGE
    ? getSpansString(document)
    : document.content;
};

export * from './types';
export * from './primary';
