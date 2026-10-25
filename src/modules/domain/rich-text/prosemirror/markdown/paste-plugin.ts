import { Node, Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

import { isMarkdown } from './detection';

export const pluginKey = new PluginKey('paste-markdown');

export const pasteMarkdownPlugin = (
  parseMarkdown: (input: string) => Promise<Node>
) => {
  return new Plugin({
    key: pluginKey,
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        const text = clipboardData?.getData('text/plain');

        if (text && isMarkdown(text)) {
          // Defer async parsing and dispatch to after the event loop tick
          setTimeout(async () => {
            let parsed: Node;

            try {
              parsed = await parseMarkdown(text);
            } catch {
              // The plugin is only responsible for the paste: when the Markdown
              // can't be parsed, there's nothing to paste. Reporting the parsing
              // failure is up to the consumer that provides `parseMarkdown`.
              return;
            }

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
