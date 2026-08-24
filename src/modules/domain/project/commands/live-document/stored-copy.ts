import { type ConvergentDocumentVersion } from '../../../../../modules/domain/rich-text';

export type StoredCopy = {
  content: string;
  // The version the app takes the stored content to derive from.
  base: ConvergentDocumentVersion;
};

export const storedCopy = ({
  content,
  base,
}: {
  content: string;
  base: ConvergentDocumentVersion;
}): StoredCopy => ({ content, base });

export const rebasedOn =
  (base: ConvergentDocumentVersion) =>
  (stored: StoredCopy): StoredCopy => ({ content: stored.content, base });
