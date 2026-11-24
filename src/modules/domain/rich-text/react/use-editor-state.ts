import { type EditorState } from 'prosemirror-state';
import { useContext, useSyncExternalStore } from 'react';

import { ProseMirrorContext } from './prosemirror-context';

// A value read from the editor's state; `undefined` while the editor holds no
// document. `select` must give the same value for the same state.
export const useEditorState = <T>(
  select: (state: EditorState) => T
): T | undefined => {
  const { subscribeToViewState, getViewState } = useContext(ProseMirrorContext);

  return useSyncExternalStore(subscribeToViewState, () => {
    const state = getViewState();

    return state ? select(state) : undefined;
  });
};
