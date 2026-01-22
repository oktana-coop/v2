import { Node, Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

export const pluginKey = new PluginKey('paste-markdown');

export const pasteMarkdownPlugin = (
  parseMarkdown: (input: string) => Promise<Node>
) => {
  return new Plugin({
    key: pluginKey,
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;

        const html = clipboardData?.getData('text/html');
        if (html) {
          // Let ProseMirror handle HTML pastes
          return false;
        }

        const text = clipboardData?.getData('text/plain');

        if (text && /[*_`~#-]/.test(text)) {
          // Defer async parsing and dispatch to after the event loop tick
          setTimeout(async () => {
            const parsed = await parseMarkdown(text);
            const tr = view.state.tr.replaceSelection(
              new Slice(parsed.content, 0, 0)
            );
            view.dispatch(tr);
          }, 0);
          return true; // Prevent default paste
        }

        return false;
      },
    },
  });
};
