import {
  type BinaryRichTextRepresentation,
  type RichTextRepresentation,
  type TextRichTextRepresentation,
} from '../constants/representations';

export type RepresentationTransformAssetFile = {
  // Relative to the same root as `resourcePath`.
  relativePath: string;
  bytes: Uint8Array;
};

export type TransformToTextArgs = {
  from: RichTextRepresentation;
  to: TextRichTextRepresentation;
  input: string;
  assetFiles?: ReadonlyArray<RepresentationTransformAssetFile>;
  // The base directory document relative asset paths are resolved against.
  resourcePath?: string;
};

export type TransformToBinaryArgs = {
  from: RichTextRepresentation;
  to: BinaryRichTextRepresentation;
  input: string;
  stylesheet?: string;
  assetFiles?: ReadonlyArray<RepresentationTransformAssetFile>;
  // The base directory document relative asset paths are resolved against.
  resourcePath?: string;
};

export type RepresentationTransform = {
  transformToText: (args: TransformToTextArgs) => Promise<string>;
  transformToBinary: (args: TransformToBinaryArgs) => Promise<Uint8Array>;
};
