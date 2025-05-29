import {
  RichTextRepresentation,
  richTextRepresentations,
} from '../../constants/representations';

export const representationToCliArg = (
  representation: RichTextRepresentation
): string => {
  switch (representation) {
    case richTextRepresentations.AUTOMERGE:
      return 'automerge';
    case richTextRepresentations.MARKDOWN:
      return 'markdown';
    case richTextRepresentations.HTML:
      return 'html';
    case richTextRepresentations.PANDOC:
    default:
      return 'pandoc';
  }
};
