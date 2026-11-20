import { useContext, useSyncExternalStore } from 'react';

import { prosemirror } from '../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../modules/domain/rich-text/react/prosemirror-context';

const { getDocFrontMatter } = prosemirror;

// `undefined` while the editor holds no document.
export const useEditorFrontMatter = (): string | null | undefined => {
  const { subscribeToViewState, getViewState } = useContext(ProseMirrorContext);

  return useSyncExternalStore(subscribeToViewState, () => {
    const state = getViewState();

    return state ? getDocFrontMatter(state.doc) : undefined;
  });
};
