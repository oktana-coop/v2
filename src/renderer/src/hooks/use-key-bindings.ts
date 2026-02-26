import { useEffect } from 'react';

type Modifier = 'ctrl' | 'shift' | 'alt';
type Letters = 'k' | 'o' | 't' | 's' | 'm' | 'h' | 'w' | 'd' | 'f' | 'l'; // for now only the ones used in the application
type SpecialKey = 'enter' | 'escape' | 'tab' | ',';
type Key = Letters | SpecialKey;

export type KeyBinding =
  | `${Key}`
  | `${Modifier}+${Key}`
  | `${Modifier}+${Modifier}+${Key}`;

type KeyBindings = {
  [K in KeyBinding]?: () => void;
};

export const useKeyBindings = (keyBindings: KeyBindings) => {
  useEffect(() => {
    const singleKeyBindings = Object.keys(keyBindings).filter((key) => {
      return !key.includes('+');
    });
    const metaKeyBindings = Object.keys(keyBindings).filter((key) => {
      return key.startsWith('ctrl+');
    });
    const metaShiftKeyBindings = Object.keys(keyBindings).filter((key) => {
      return key.startsWith('ctrl+shift+');
    });
    const metaAltKeyBindings = Object.keys(keyBindings).filter((key) => {
      return key.startsWith('ctrl+alt+');
    });

    const handleGenericKeyDown = (event: KeyboardEvent) => {
      if (
        metaShiftKeyBindings
          .map((binding) => {
            return binding.split('ctrl+shift+').slice(1)[0];
          })
          .includes(event.key.toLowerCase()) &&
        (event.ctrlKey === true || event.metaKey === true) &&
        event.shiftKey === true
      ) {
        event.preventDefault();
        const fn =
          keyBindings[`ctrl+shift+${event.key.toLowerCase()}` as KeyBinding];
        if (fn) return fn();
      }

      if (
        metaAltKeyBindings
          .map((binding) => {
            return binding.split('ctrl+alt+').slice(1)[0];
          })
          .includes(event.key.toLowerCase()) &&
        (event.ctrlKey === true || event.metaKey === true) &&
        event.altKey === true
      ) {
        event.preventDefault();
        const fn =
          keyBindings[`ctrl+alt+${event.key.toLowerCase()}` as KeyBinding];
        if (fn) return fn();
      }

      if (
        metaKeyBindings
          .map((binding) => {
            return binding.split('ctrl+').slice(1)[0];
          })
          .includes(event.key.toLowerCase()) &&
        (event.ctrlKey === true || event.metaKey === true) &&
        event.shiftKey === false
      ) {
        event.preventDefault();
        const fn = keyBindings[`ctrl+${event.key.toLowerCase()}` as KeyBinding];
        if (fn) return fn();
      }

      if (singleKeyBindings.includes(event.key.toLowerCase())) {
        event.preventDefault();
        const fn = keyBindings[`${event.key.toLowerCase()}` as KeyBinding];
        if (fn) return fn();
      }
    };

    window.addEventListener('keydown', handleGenericKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGenericKeyDown);
    };
  }, [keyBindings]);
};
