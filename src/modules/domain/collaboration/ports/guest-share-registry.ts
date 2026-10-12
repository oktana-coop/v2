import { type ShareId } from '../models';

export type GuestShare = {
  shareId: ShareId;
  name: string;
  lastOpenedAt: number;
};

export type GuestShareRegistry = {
  listShares: () => GuestShare[];
  rememberShare: (share: { shareId: ShareId; sharedName: string }) => void;
  forgetShare: (shareId: ShareId) => void;
  labelShare: (args: { shareId: ShareId; label: string }) => void;
  subscribe: (listener: () => void) => () => void;
};
