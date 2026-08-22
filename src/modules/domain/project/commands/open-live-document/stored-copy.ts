import { type ConvergentDocumentVersion } from '../../../../../modules/domain/rich-text';

// What the store holds, as far as the app knows, and the live version that
// content was derived from. A document opened at a share holds something the
// store has never seen, which the first write then carries to it.
export type StoredCopy = {
  content: string;
  version: ConvergentDocumentVersion;
  // A version the store was told not to follow. Any later change produces a
  // new version, which is written again.
  cancelledVersion: ConvergentDocumentVersion | null;
};

export const storedCopy = ({
  content,
  version,
}: {
  content: string;
  version: ConvergentDocumentVersion;
}): StoredCopy => ({ content, version, cancelledVersion: null });

// Content the store already holds is a write or read of our own coming back,
// not an edit made by another hand.
export const holdsContent = ({
  stored,
  content,
}: {
  stored: StoredCopy;
  content: string;
}): boolean => stored.content === content;

export const mayWrite = ({
  stored,
  version,
}: {
  stored: StoredCopy;
  version: ConvergentDocumentVersion;
}): boolean => version !== stored.cancelledVersion;

export const nowHolding = ({
  stored,
  content,
  version,
}: {
  stored: StoredCopy;
  content: string;
  version: ConvergentDocumentVersion;
}): StoredCopy => ({ ...stored, content, version });

export const writeCancelled = ({
  stored,
  version,
}: {
  stored: StoredCopy;
  version: ConvergentDocumentVersion;
}): StoredCopy => ({ ...stored, cancelledVersion: version });

// The document keeps its content across a switch, but not its versions: what
// the store holds now derives from the new document's state, and nothing said
// about the old one applies.
export const rebasedOn = ({
  stored,
  version,
}: {
  stored: StoredCopy;
  version: ConvergentDocumentVersion;
}): StoredCopy => ({
  content: stored.content,
  version,
  cancelledVersion: null,
});
