import { type GuestShare, type ShareId } from '../../ports';

export type StoredGuestShare = {
  shareId: ShareId;
  // The share's own name is a suggestion: an entry follows it until the user
  // gives the entry a label of their own.
  sharedName: string;
  label: string | null;
  lastOpenedAt: number;
};

export const toGuestShare = ({
  shareId,
  sharedName,
  label,
  lastOpenedAt,
}: StoredGuestShare): GuestShare => ({
  shareId,
  name: label ?? sharedName,
  lastOpenedAt,
});

export const createOrRefreshGuestShare = ({
  existing,
  shareId,
  sharedName,
  openedAt,
}: {
  existing: StoredGuestShare | undefined;
  shareId: ShareId;
  sharedName: string;
  openedAt: number;
}): StoredGuestShare =>
  existing
    ? { ...existing, sharedName, lastOpenedAt: openedAt }
    : { shareId, sharedName, label: null, lastOpenedAt: openedAt };

export const replaceOrPrependGuestShare = ({
  current,
  share,
}: {
  current: ReadonlyArray<StoredGuestShare>;
  share: StoredGuestShare;
}): StoredGuestShare[] => {
  const isSameShare = (existing: StoredGuestShare) =>
    existing.shareId === share.shareId;

  return current.some(isSameShare)
    ? current.map((existing) => (isSameShare(existing) ? share : existing))
    : [share, ...current];
};

export const labelGuestShare = ({
  share,
  label,
}: {
  share: StoredGuestShare;
  label: string;
}): StoredGuestShare => ({ ...share, label: label.trim() || null });
