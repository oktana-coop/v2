import { prosemirror } from '../../../../../modules/domain/rich-text';
import { useEditorState } from '../../../../../modules/domain/rich-text/react/use-editor-state';

const { getDocFrontMatter } = prosemirror;

// `undefined` while the editor holds no document.
export const useEditorFrontMatter = (): string | null | undefined =>
  useEditorState((state) => getDocFrontMatter(state.doc));
