import type * as Queue from 'effect/Queue';
import { type EditorState, PluginKey } from 'prosemirror-state';

import {
  type InvalidMetadataError,
  type InvalidMetadataKeyError,
  type UnrepresentableContentError,
} from '../../errors';
import { type MetadataEdit } from '../../models';
import {
  emptyHistory,
  type FrontMatterChange,
  type MetadataEditHistoryOperation,
  type MetadataHistory,
} from './history';

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

export type MetadataEditingState = {
  failures: MetadataEditFailures;
  history: MetadataHistory;
};

export type MetadataEditCommit =
  { type: 'edit'; edit: MetadataEdit } | { type: MetadataEditHistoryOperation };

// What a transaction tells the plugin.
export type MetadataEditingMeta =
  | { type: 'failed'; failure: MetadataEditFailure }
  | { type: 'failureCleared'; key: string }
  // An edit's change; the property's earlier failure no longer stands.
  | { type: 'committed'; key: string; change: FrontMatterChange }
  // The change an undo or redo made.
  | {
      type: 'reversed';
      operation: MetadataEditHistoryOperation;
      change: FrontMatterChange;
    }
  | { type: 'reversalFailed'; operation: MetadataEditHistoryOperation };

export const pluginKey = new PluginKey<MetadataEditingState>(
  'metadata-editing'
);

// The plugin's queue of commits, in its spec: it lasts as long as the plugin, not an editor state.
export const getMetadataEditCommits = (
  state: EditorState
): Queue.Enqueue<MetadataEditCommit> | undefined =>
  pluginKey.get(state)?.spec.commits;

export const hasMetadataEditingPlugin = (state: EditorState): boolean =>
  pluginKey.get(state) !== undefined;

const noFailures: MetadataEditFailures = new Map();

export const getMetadataEditFailures = (
  state: EditorState
): MetadataEditFailures => pluginKey.getState(state)?.failures ?? noFailures;

export const getMetadataHistory = (state: EditorState): MetadataHistory =>
  pluginKey.getState(state)?.history ?? emptyHistory;
