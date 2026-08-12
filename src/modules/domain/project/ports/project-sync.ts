import * as Effect from 'effect/Effect';

// Opaque capability: holding the link is what admits a peer to the share.
export type ShareUrl = string;

export type ShareDocumentArgs = {
  content: string;
};

export type LeaveSharedDocumentArgs = {
  shareUrl: ShareUrl;
};

export type ProjectSync = {
  shareDocument: (args: ShareDocumentArgs) => Effect.Effect<ShareUrl>;
  // Ends this client's participation: the shared document stays available to
  // the peers that still hold it.
  leaveSharedDocument: (args: LeaveSharedDocumentArgs) => Effect.Effect<void>;
};
