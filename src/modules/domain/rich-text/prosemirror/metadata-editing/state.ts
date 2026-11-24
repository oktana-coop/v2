import type * as Queue from 'effect/Queue';
import { type EditorState, PluginKey } from 'prosemirror-state';

import {
  type InvalidMetadataError,
  type InvalidMetadataKeyError,
  type UnrepresentableContentError,
} from '../../errors';
import { type MetadataEdit } from '../../models';

// An edit the front matter couldn't take, and why.
export type MetadataEditFailure = {
  edit: MetadataEdit;
  error:
    | InvalidMetadataError
    | InvalidMetadataKeyError
    | UnrepresentableContentError;
};

// The last failed edit of each property, by its key.
export type MetadataEditFailures = ReadonlyMap<string, MetadataEditFailure>;

// What a transaction tells the plugin.
export type MetadataEditingMeta =
  | { type: 'failed'; failure: MetadataEditFailure }
  | { type: 'failureCleared'; key: string };

export const pluginKey = new PluginKey<MetadataEditFailures>(
  'metadata-editing'
);

// The plugin's queue of edits, in its spec: it lasts as long as the plugin, not an editor state.
export const getEdits = (
  state: EditorState
): Queue.Enqueue<MetadataEdit> | undefined => pluginKey.get(state)?.spec.edits;

export const hasMetadataEditingPlugin = (state: EditorState): boolean =>
  pluginKey.get(state) !== undefined;

const noFailures: MetadataEditFailures = new Map();

export const getMetadataEditFailures = (
  state: EditorState
): MetadataEditFailures => pluginKey.getState(state) ?? noFailures;
