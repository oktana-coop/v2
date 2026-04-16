import { useCallback, useEffect, useState } from 'react';

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

// Resolve the logical letter for a physical key code (e.g. 'KeyP').
// Bindings are defined by logical letter (e.g. ctrl+alt+p), and the layout map
// translates physical keys to logical letters — so the user always presses the
// key labeled "P" on their layout, regardless of where it sits physically.
// Without a layout map, falls back to QWERTY (where code and letter coincide).
export const logicalKey =
  (layoutMap: KeyboardLayoutMap | null) =>
  (code: string): string | null => {
    const fromLayout = layoutMap?.get(code);
    if (fromLayout?.length === 1) return fromLayout.toLowerCase();

    // QWERTY fallback
    return code.startsWith('Key') ? code.slice(3).toLowerCase() : null;
  };

// On macOS, pressing Alt/Option with a letter key enters a compose mode for accented
// characters (e.g. Option+N starts a tilde for ñ). The browser reports event.key === 'Dead'
// instead of the actual letter. We fall back to the physical key in that case.
export const normalizeKey =
  (layoutMap: KeyboardLayoutMap | null) =>
  (event: Pick<KeyboardEvent, 'key' | 'code'>): string => {
    if (event.key === 'Dead') {
      return logicalKey(layoutMap)(event.code) ?? 'dead';
    }
    return event.key.toLowerCase();
  };

type KeyEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

export const matchBinding =
  (layoutMap: KeyboardLayoutMap | null) =>
  ({
    keyBindings,
    event,
  }: {
    keyBindings: KeyBindings;
    event: KeyEvent;
  }): KeyBinding | null => {
    const key = normalizeKey(layoutMap)(event);
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

    // When Alt is held, event.key may be a special character (e.g. Option+P → π)
    // rather than the intended letter. Use the physical key to match the binding.
    const resolvedKey = logicalKey(layoutMap)(event.code) ?? key;

    if (
      meta &&
      event.altKey &&
      metaAltKeyBindings
        .map((b) => b.split('ctrl+alt+').slice(1)[0])
        .includes(resolvedKey)
    ) {
      return `ctrl+alt+${resolvedKey}` as KeyBinding;
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
  const [layoutMap, setLayoutMap] = useState<KeyboardLayoutMap | null>(null);

  useEffect(() => {
    const fetchLayoutMap = async () => {
      const map = await navigator.keyboard?.getLayoutMap();
      if (map) setLayoutMap(map);
    };

    fetchLayoutMap();
  }, []);

  const match = useCallback(
    (args: { keyBindings: KeyBindings; event: KeyEvent }) =>
      matchBinding(layoutMap)(args),
    [layoutMap]
  );

  useEffect(() => {
    const handleGenericKeyDown = (event: KeyboardEvent) => {
      const binding = match({ keyBindings, event });
      if (binding) {
        event.preventDefault();
        keyBindings[binding]?.();
      }
    };

    window.addEventListener('keydown', handleGenericKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGenericKeyDown);
    };
  }, [keyBindings, match]);
};
