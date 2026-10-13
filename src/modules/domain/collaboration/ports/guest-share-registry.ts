import { type ShareId } from '../models';

export type GuestShare = {
  shareId: ShareId;
  name: string;
  // The kind of document the share holds, as the share says.
  kind: string;
  lastOpenedAt: number;
};

export type GuestShareRegistry = {
  listShares: () => GuestShare[];
  rememberShare: (share: {
    shareId: ShareId;
    sharedName: string;
    kind: string;
  }) => void;
  forgetShare: (shareId: ShareId) => void;
  labelShare: (args: { shareId: ShareId; label: string }) => void;
  subscribe: (listener: () => void) => () => void;
};
