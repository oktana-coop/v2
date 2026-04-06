import { useEffect } from 'react';

type Modifier = 'ctrl' | 'shift' | 'alt';
type Letters =
  | 'k'
  | 'o'
  | 't'
  | 'n'
  | 's'
  | 'm'
  | 'h'
  | 'w'
  | 'd'
  | 'f'
  | 'l'
  | 'p'; // for now only the ones used in the application
type SpecialKey = 'enter' | 'escape' | 'tab' | ',';
type Key = Letters | SpecialKey;

export type KeyBinding =
  | `${Key}`
  | `${Modifier}+${Key}`
  | `${Modifier}+${Modifier}+${Key}`;

export type KeyBindings = {
  [K in KeyBinding]?: () => void;
};

// On macOS, pressing Option (Alt) with a letter key enters a compose mode for accented
// characters (e.g. Option+N starts a tilde for ñ). The browser reports event.key === 'Dead'
// instead of the actual letter, so we fall back to the physical key via event.code (e.g. 'KeyN').
// Note: event.code uses QWERTY positions, so this fallback assumes a QWERTY layout.
export const normalizeKey = (
  event: Pick<KeyboardEvent, 'key' | 'code'>
): string =>
  event.key === 'Dead' && event.code.startsWith('Key')
    ? event.code
        // strip 'Key' prefix: 'KeyN' → 'n'
        .slice(3)
        .toLowerCase()
    : event.key.toLowerCase();

type KeyEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

export const matchBinding = (
  keyBindings: KeyBindings,
  event: KeyEvent
): KeyBinding | null => {
  const key = normalizeKey(event);
  const meta = event.ctrlKey || event.metaKey;

  const singleKeyBindings = Object.keys(keyBindings).filter((b) => {
    return !b.includes('+');
  });
  const metaKeyBindings = Object.keys(keyBindings).filter((b) => {
    return (
      b.startsWith('ctrl+') &&
      !b.startsWith('ctrl+shift+') &&
      !b.startsWith('ctrl+alt+')
    );
  });
  const metaShiftKeyBindings = Object.keys(keyBindings).filter((b) => {
    return b.startsWith('ctrl+shift+');
  });
  const metaAltKeyBindings = Object.keys(keyBindings).filter((b) => {
    return b.startsWith('ctrl+alt+');
  });

  if (
    meta &&
    event.shiftKey &&
    metaShiftKeyBindings
      .map((b) => b.split('ctrl+shift+').slice(1)[0])
      .includes(key)
  ) {
    return `ctrl+shift+${key}` as KeyBinding;
  }

  if (
    meta &&
    event.altKey &&
    metaAltKeyBindings
      .map((b) => b.split('ctrl+alt+').slice(1)[0])
      .includes(key)
  ) {
    return `ctrl+alt+${key}` as KeyBinding;
  }

  if (
    meta &&
    !event.shiftKey &&
    metaKeyBindings.map((b) => b.split('ctrl+').slice(1)[0]).includes(key)
  ) {
    return `ctrl+${key}` as KeyBinding;
  }

  if (singleKeyBindings.includes(key)) {
    return key as KeyBinding;
  }

  return null;
};

export const useKeyBindings = (keyBindings: KeyBindings) => {
  useEffect(() => {
    const handleGenericKeyDown = (event: KeyboardEvent) => {
      const binding = matchBinding(keyBindings, event);
      if (binding) {
        event.preventDefault();
        keyBindings[binding]?.();
      }
    };

    window.addEventListener('keydown', handleGenericKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGenericKeyDown);
    };
  }, [keyBindings]);
};
