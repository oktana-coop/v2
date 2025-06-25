import { type RichTextRepresentation } from '../constants/representations';

export type TransformArgs = {
  from: RichTextRepresentation;
  to: RichTextRepresentation;
  input: string;
};

export type RepresentationTransform = {
  transform: (args: TransformArgs) => Promise<string>;
};
