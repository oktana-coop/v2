import { type Node } from 'prosemirror-model';
import { type EditorState } from 'prosemirror-state';

import { editorState, runCommand } from '../test-utils';
import { setSearchQuery } from './commands';
import { searchPlugin } from './plugin';

// A state with the search plugin active and the given query applied.
export const stateWithQuery = (
  children: Node[],
  search: string
): EditorState => {
  const state = editorState(children, [searchPlugin()]);
  return runCommand({ state, command: setSearchQuery(search) }).next;
};
