import { type ConvergentDocumentVersion } from '../../../collaboration';

export type StoredCopy<DocumentType> = {
  document: DocumentType;
  // The version the app takes the stored document to derive from.
  base: ConvergentDocumentVersion;
};

export const storedCopy = <DocumentType>({
  document,
  base,
}: {
  document: DocumentType;
  base: ConvergentDocumentVersion;
}): StoredCopy<DocumentType> => ({ document, base });

export const rebasedOn =
  (base: ConvergentDocumentVersion) =>
  <DocumentType>(
    stored: StoredCopy<DocumentType>
  ): StoredCopy<DocumentType> => ({
    document: stored.document,
    base,
  });
