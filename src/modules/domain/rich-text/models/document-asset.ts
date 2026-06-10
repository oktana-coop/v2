import { type AssetDocRelPath } from './document-asset-src';

// An asset reference as it appears in a rich-text document.
export type DocumentAsset = {
  src: AssetDocRelPath;
  alt: string | null;
  title: string | null;
};
