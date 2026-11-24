import type * as Queue from 'effect/Queue';
import { type EditorState, PluginKey } from 'prosemirror-state';

import { type MetadataEdit } from '../../models';

export const pluginKey = new PluginKey('metadata-editing');

// The plugin's queue of edits, in its spec: it lasts as long as the plugin, not an editor state.
export const getEdits = (
  state: EditorState
): Queue.Enqueue<MetadataEdit> | undefined => pluginKey.get(state)?.spec.edits;

export const hasMetadataEditingPlugin = (state: EditorState): boolean =>
  pluginKey.get(state) !== undefined;
