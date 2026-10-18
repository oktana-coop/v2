// Opaque capability: holding the link is what admits a peer to the share.
export type ShareId = string;

export const urlEncodeShareId = (shareId: ShareId): string =>
  encodeURIComponent(shareId);

export const decodeUrlEncodedShareId = (encoded: string): ShareId =>
  decodeURIComponent(encoded);
