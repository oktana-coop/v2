import { richTextRepresentations } from '../representation';
import { getSpansString } from './automerge';
import { type RichTextDocument, type VersionedDocument } from './types';

export const isEmpty = (document: VersionedDocument): boolean => {
  return document.content === '';
};

export const getDocumentRichTextContent = (
  document: RichTextDocument
): string => {
  return document.representation === richTextRepresentations.AUTOMERGE
    ? getSpansString(document)
    : document.content;
};

export * from './types';
