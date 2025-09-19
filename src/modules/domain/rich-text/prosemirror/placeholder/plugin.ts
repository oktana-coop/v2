import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const pluginKey = new PluginKey('placeholder');

export const placeholderPlugin = (placeholderText: string) => {
  return new Plugin({
    key: pluginKey,
    props: {
      decorations(state) {
        const doc = state.doc;

        if (
          doc.childCount === 1 &&
          doc.firstChild?.isTextblock &&
          doc.firstChild.content.size === 0
        ) {
          const placeholderElement = document.createElement('span');
          placeholderElement.textContent = placeholderText;

          placeholderElement.className =
            'text-gray-400 pointer-events-none select-none';

          return DecorationSet.create(doc, [
            Decoration.widget(1, placeholderElement),
          ]);
        }
      },
    },
  });
};
