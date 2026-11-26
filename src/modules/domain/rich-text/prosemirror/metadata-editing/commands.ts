import * as Queue from 'effect/Queue';
import { type Command } from 'prosemirror-state';

import { type MetadataEdit } from '../../models';
import {
  type FrontMatterEdit,
  getFrontMatterEditFailure,
  getMetadataEditCommits,
  getMetadataEditFailures,
  type MetadataEditCommit,
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

const queueCommit =
  (commit: MetadataEditCommit): Command =>
  (state, dispatch) => {
    const commits = getMetadataEditCommits(state);

    if (!commits) {
      return false;
    }

    if (dispatch) {
      Queue.unsafeOffer(commits, commit);
    }

    return true;
  };

export const editMetadata = (edit: MetadataEdit): Command =>
  queueCommit({ type: 'metadataEdit', edit });

export const editFrontMatter = (edit: FrontMatterEdit): Command =>
  queueCommit({ type: 'frontMatterEdit', edit });

export const undoMetadataEdit: Command = queueCommit({ type: 'undo' });

export const redoMetadataEdit: Command = queueCommit({ type: 'redo' });

// Forgets the property's last failed edit; it applies when there is one.
export const clearMetadataEditFailure =
  (key: string): Command =>
  (state, dispatch) => {
    if (!getMetadataEditFailures(state).has(key)) {
      return false;
    }

    const meta: MetadataEditingMeta = {
      type: 'metadataEditFailureCleared',
      key,
    };
    dispatch?.(state.tr.setMeta(pluginKey, meta));
    return true;
  };

export const clearFrontMatterEditFailure: Command = (state, dispatch) => {
  if (getFrontMatterEditFailure(state) === null) {
    return false;
  }

  const meta: MetadataEditingMeta = { type: 'frontMatterEditFailureCleared' };
  dispatch?.(state.tr.setMeta(pluginKey, meta));
  return true;
};
