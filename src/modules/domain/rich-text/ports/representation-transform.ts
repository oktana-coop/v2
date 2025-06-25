import {
  type RichTextRepresentation,
  richTextRepresentations,
} from '../constants/representations';

export type TransformArgs = {
  from: RichTextRepresentation;
  to: RichTextRepresentation;
  input: string;
};

export type TransformFromAutomergeArgs = {
  spans: string;
  representation: Omit<
    RichTextRepresentation,
    typeof richTextRepresentations.AUTOMERGE
  >;
};

export type TransformToAutomergeArgs = {
  input: string;
  representation: Omit<
    RichTextRepresentation,
    typeof richTextRepresentations.AUTOMERGE
  >;
};

export type RepresentationTransform = {
  transform: (args: TransformArgs) => Promise<string>;
  transformFromAutomerge: (args: TransformFromAutomergeArgs) => Promise<string>;
  transformToAutomerge: (args: TransformToAutomergeArgs) => Promise<string>;
};
