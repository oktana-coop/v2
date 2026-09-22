export const urlEncodeShareId = (shareId: string): string =>
  encodeURIComponent(shareId);

export const decodeUrlEncodedShareId = (encoded: string): string =>
  decodeURIComponent(encoded);
