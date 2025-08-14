import {
  type BinaryRichTextRepresentation,
  type RichTextRepresentation,
  type TextRichTextRepresentation,
} from '../constants/representations';

export type TransformToTextArgs = {
  from: RichTextRepresentation;
  to: TextRichTextRepresentation;
  input: string;
};

export type TransformToBinaryArgs = {
  from: RichTextRepresentation;
  to: BinaryRichTextRepresentation;
  input: string;
};

export type RepresentationTransform = {
  transformToText: (args: TransformToTextArgs) => Promise<string>;
  transformToBinary: (args: TransformToBinaryArgs) => Promise<Uint8Array>;
};
