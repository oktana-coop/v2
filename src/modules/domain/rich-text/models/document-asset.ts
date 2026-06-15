import { type DocumentAssetSrc } from './document-asset-src';

// An asset reference as it appears in a rich-text document.
export type DocumentAsset = {
  src: DocumentAssetSrc;
  alt: string | null;
  title: string | null;
};
