import { type Extension, Prec } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';

// The letter a shortcut's key stands for, in the case Shift gives it.
const shortcutLetter = (event: KeyboardEvent): string | null => {
  if (!/^[a-z]$/i.test(event.key)) return null;
  if (!(event.ctrlKey || event.metaKey || event.altKey)) return null;

  return event.shiftKey ? event.key.toUpperCase() : event.key.toLowerCase();
};

const withKey = ({
  event,
  key,
}: {
  event: KeyboardEvent;
  key: string;
}): KeyboardEvent =>
  new Proxy(event, {
    get: (target, property) => {
      if (property === 'key') return key;

      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

// Letter shortcuts match by whether Shift is held, whatever the case of the key.
export const caseInsensitiveKeyBindings: Extension = Prec.highest(
  EditorView.domEventHandlers({
    keydown: (event, view) => {
      const key = shortcutLetter(event);
      if (key === null || key === event.key) return false;

      return runScopeHandlers(view, withKey({ event, key }), 'editor');
    },
  })
);
