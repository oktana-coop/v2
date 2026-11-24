import * as Queue from 'effect/Queue';
import { type Command } from 'prosemirror-state';

import { type MetadataEdit } from '../../models';
import {
  getEdits,
  getMetadataEditFailures,
  type MetadataEditingMeta,
  pluginKey,
} from './state';

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

// Forgets the property's last failed edit; it applies when there is one.
export const clearMetadataEditFailure =
  (key: string): Command =>
  (state, dispatch) => {
    if (!getMetadataEditFailures(state).has(key)) {
      return false;
    }

    const meta: MetadataEditingMeta = { type: 'failureCleared', key };
    dispatch?.(state.tr.setMeta(pluginKey, meta));
    return true;
  };
