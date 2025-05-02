import {
  RichTextRepresentation,
  richTextRepresentations,
} from '../../constants/representations';

export const representationToCliArg = (
  representation: Omit<
    RichTextRepresentation,
    typeof richTextRepresentations.AUTOMERGE
  >
): string => {
  switch (representation) {
    case richTextRepresentations.MARKDOWN:
      return 'markdown';
    case richTextRepresentations.HTML:
      return 'html';
    case richTextRepresentations.PROSEMIRROR:
      return 'prosemirror';
    case richTextRepresentations.PANDOC:
    default:
      return 'pandoc';
  }
};
