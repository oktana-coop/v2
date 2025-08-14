import { type RichTextRepresentation } from '../constants/representations';

export type TransformArgs = {
  from: RichTextRepresentation;
  to: RichTextRepresentation;
  input: string;
};

export type RepresentationTransform = {
  transformToText: (args: TransformArgs) => Promise<string>;
  transformToBinary: (args: TransformArgs) => Promise<Uint8Array>;
};
