import { removeExtension } from '../../../../infrastructure/filesystem';
import { type ShareId } from '../../models';
import { type GuestShare } from '../../ports';

export type StoredGuestShare = {
  shareId: ShareId;
  // The share's own name is a suggestion: an entry follows it until the user
  // gives the entry a label of their own.
  sharedName: string;
  kind: string;
  label: string | null;
  lastOpenedAt: number;
};

export const toGuestShare = ({
  shareId,
  sharedName,
  kind,
  label,
  lastOpenedAt,
}: StoredGuestShare): GuestShare => ({
  shareId,
  // Guests have no files, so an extension says nothing to them.
  name: label ?? removeExtension(sharedName),
  kind,
  lastOpenedAt,
});

export const createOrRefreshGuestShare = ({
  existing,
  shareId,
  sharedName,
  kind,
  openedAt,
}: {
  existing: StoredGuestShare | undefined;
  shareId: ShareId;
  sharedName: string;
  kind: string;
  openedAt: number;
}): StoredGuestShare =>
  existing
    ? { ...existing, sharedName, kind, lastOpenedAt: openedAt }
    : { shareId, sharedName, kind, label: null, lastOpenedAt: openedAt };

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
