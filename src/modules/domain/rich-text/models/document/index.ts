import { richTextRepresentations } from '../../constants';
import { getSpansString } from './automerge';
import { type RichTextDocument, type VersionedDocument } from './types';

export const isEmpty = (document: VersionedDocument): boolean => {
  return document.content === '';
};

export const getDocumentRichTextContent = (
  document: RichTextDocument
): string => {
  return document.representation === richTextRepresentations.AUTOMERGE ||
    // There are some old document versions without the representataion set. So the TS type is not completely accurate for all historical versions of a document.
    // But we should be able to remove this check really soon (don't expect many people to have v2 versions < 0.6.6)
    !document.representation
    ? getSpansString(document)
    : document.content;
};

export * from './types';
