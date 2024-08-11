import type { MarkType } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';

import {
  BlockElementType,
  blockElementTypes,
} from '../../../modules/rich-text/constants/blocks';

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

export const isMarkActive =
  (markType: MarkType) =>
  (state: EditorState): boolean => {
    const { from, to, empty, $cursor } = state.selection as TextSelection;

    if (empty && $cursor) {
      return Boolean(markType.isInSet(state.storedMarks || $cursor.marks()));
    } else {
      return state.doc.rangeHasMark(from, to, markType);
    }
  };
