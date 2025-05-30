import {
  type RichTextRepresentation,
  richTextRepresentations,
} from '../constants/representations';

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
  transformFromAutomerge: (args: TransformFromAutomergeArgs) => Promise<string>;
  transformToAutomerge: (args: TransformToAutomergeArgs) => Promise<string>;
};
