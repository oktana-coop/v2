import { describe, expect, it } from 'vitest';

import { matchBinding, normalizeKey, logicalKey } from './use-key-bindings';

const event = (
  overrides: Partial<{
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {}
) => ({
  key: 'n',
  code: 'KeyN',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

// On QWERTY, physical KeyP maps to 'p'.
// On Dvorak, physical KeyP maps to 'r' (different logical letter, same physical key).
const qwertyLayout = new Map([
  ['KeyN', 'n'],
  ['KeyP', 'p'],
]) as unknown as KeyboardLayoutMap;

const dvorakLayout = new Map([
  ['KeyN', 'b'],
  ['KeyP', 'r'],
]) as unknown as KeyboardLayoutMap;

describe('logicalKey', () => {
  it('resolves to the logical letter on QWERTY', () => {
    expect(logicalKey(qwertyLayout)('KeyP')).toBe('p');
  });

  it('resolves to the logical letter on Dvorak', () => {
    expect(logicalKey(dvorakLayout)('KeyP')).toBe('r');
  });

  it('falls back to QWERTY derivation when layout map is unavailable', () => {
    expect(logicalKey(null)('KeyP')).toBe('p');
  });

  it('returns null for non-letter codes without a layout map', () => {
    expect(logicalKey(null)('Digit1')).toBeNull();
  });
});

describe('normalizeKey', () => {
  const normalize = normalizeKey(null);

  it('returns the lowercase key for regular key events', () => {
    expect(normalize({ key: 'N', code: 'KeyN' })).toBe('n');
  });

  it('returns the lowercase key for special keys', () => {
    expect(normalize({ key: 'Enter', code: 'Enter' })).toBe('enter');
  });

  it('falls back to event.code when event.key is Dead (Alt+letter compose mode)', () => {
    expect(normalize({ key: 'Dead', code: 'KeyN' })).toBe('n');
  });

  it('does not fall back to event.code when Dead key is not a letter', () => {
    expect(normalize({ key: 'Dead', code: 'Digit1' })).toBe('dead');
  });

  it('returns the key as-is when Alt produces a special character (matchBinding handles this)', () => {
    expect(normalize({ key: 'π', code: 'KeyP' })).toBe('π');
  });

  it('handles already-lowercase keys', () => {
    expect(normalize({ key: 'n', code: 'KeyN' })).toBe('n');
  });

  it('resolves Dead key via QWERTY layout map', () => {
    expect(normalizeKey(qwertyLayout)({ key: 'Dead', code: 'KeyP' })).toBe('p');
  });

  it('resolves Dead key via Dvorak layout map', () => {
    expect(normalizeKey(dvorakLayout)({ key: 'Dead', code: 'KeyP' })).toBe('r');
  });
});

describe('matchBinding', () => {
  const match = matchBinding(null);

  const bindings = {
    'ctrl+shift+n': () => {},
    'ctrl+alt+n': () => {},
    'ctrl+n': () => {},
    escape: () => {},
  };

  it('matches ctrl+shift binding', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ ctrlKey: true, shiftKey: true }),
      })
    ).toBe('ctrl+shift+n');
  });

  it('matches ctrl+alt binding', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ ctrlKey: true, altKey: true }),
      })
    ).toBe('ctrl+alt+n');
  });

  it('matches ctrl binding', () => {
    expect(
      match({ keyBindings: bindings, event: event({ ctrlKey: true }) })
    ).toBe('ctrl+n');
  });

  it('matches metaKey as ctrl (macOS Cmd)', () => {
    expect(
      match({ keyBindings: bindings, event: event({ metaKey: true }) })
    ).toBe('ctrl+n');
  });

  it('matches single key binding', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ key: 'Escape', code: 'Escape' }),
      })
    ).toBe('escape');
  });

  it('returns null when no binding matches', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ key: 'k', code: 'KeyK' }),
      })
    ).toBeNull();
  });

  it('prefers ctrl+shift over ctrl when both shift and ctrl are pressed', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ ctrlKey: true, shiftKey: true }),
      })
    ).toBe('ctrl+shift+n');
  });

  it('prefers ctrl+alt over ctrl when both alt and ctrl are pressed', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({ ctrlKey: true, altKey: true }),
      })
    ).toBe('ctrl+alt+n');
  });

  it('does not match ctrl binding when shift is held', () => {
    const ctrlOnly = { 'ctrl+n': () => {} };
    expect(
      match({
        keyBindings: ctrlOnly,
        event: event({ ctrlKey: true, shiftKey: true }),
      })
    ).toBeNull();
  });

  it('handles dead key with ctrl+alt', () => {
    expect(
      match({
        keyBindings: bindings,
        event: event({
          key: 'Dead',
          code: 'KeyN',
          ctrlKey: true,
          altKey: true,
        }),
      })
    ).toBe('ctrl+alt+n');
  });

  it('resolves Alt+P special character via QWERTY fallback (no layout map)', () => {
    const withCtrlAltP = { ...bindings, 'ctrl+alt+p': () => {} };
    expect(
      match({
        keyBindings: withCtrlAltP,
        event: event({
          key: 'π',
          code: 'KeyP',
          metaKey: true,
          altKey: true,
        }),
      })
    ).toBe('ctrl+alt+p');
  });

  it('resolves Alt+P special character via QWERTY layout map', () => {
    const qwertyMatch = matchBinding(qwertyLayout);
    const withCtrlAltP = { ...bindings, 'ctrl+alt+p': () => {} };
    expect(
      qwertyMatch({
        keyBindings: withCtrlAltP,
        event: event({
          key: 'π',
          code: 'KeyP',
          metaKey: true,
          altKey: true,
        }),
      })
    ).toBe('ctrl+alt+p');
  });

  it('resolves Alt+P special character via Dvorak layout map', () => {
    // On Dvorak, physical KeyP is 'r', so the binding should be ctrl+alt+r
    const dvorakMatch = matchBinding(dvorakLayout);
    const withCtrlAltR = { ...bindings, 'ctrl+alt+r': () => {} };
    expect(
      dvorakMatch({
        keyBindings: withCtrlAltR,
        event: event({
          key: 'π',
          code: 'KeyP',
          metaKey: true,
          altKey: true,
        }),
      })
    ).toBe('ctrl+alt+r');
  });
});
