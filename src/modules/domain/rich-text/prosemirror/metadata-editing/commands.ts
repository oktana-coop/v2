import * as Queue from 'effect/Queue';
import { type Command } from 'prosemirror-state';

import { type MetadataEdit } from '../../models';
import { getEdits } from './state';

// Sets the document's front matter, outside the undo history.
export const setFrontMatter =
  (frontMatter: string | null): Command =>
  (state, dispatch) => {
    dispatch?.(
      state.tr
        .setDocAttribute('frontMatter', frontMatter)
        .setMeta('addToHistory', false)
    );
    return true;
  };

// Edits the document's metadata once the edits before it are committed; it
// applies where the plugin is installed.
export const editMetadata =
  (edit: MetadataEdit): Command =>
  (state, dispatch) => {
    const edits = getEdits(state);

    if (!edits) {
      return false;
    }

    if (dispatch) {
      Queue.unsafeOffer(edits, edit);
    }

    return true;
  };
