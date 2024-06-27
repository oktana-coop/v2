import { EditorState } from 'prosemirror-state';

import {
  BlockElementType,
  blockElementTypes,
} from '../../richText/constants/blocks';

export const getCurrentBlockType = (
  state: EditorState
): BlockElementType | null => {
  const { $from } = state.selection;

  switch ($from.node().type.name) {
    case 'paragraph':
      return blockElementTypes.PARAGRAPH;
    case 'heading':
      switch ($from.node().attrs.level) {
        case 1:
        default:
          return blockElementTypes.HEADING_1;
        case 2:
          return blockElementTypes.HEADING_2;
        case 3:
          return blockElementTypes.HEADING_3;
        case 4:
          return blockElementTypes.HEADING_4;
      }
    default:
      return null;
  }
};
