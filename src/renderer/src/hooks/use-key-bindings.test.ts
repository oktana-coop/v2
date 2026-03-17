import { describe, expect, it } from 'vitest';

import { matchBinding, normalizeKey } from './use-key-bindings';

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

describe('normalizeKey', () => {
  it('returns the lowercase key for regular key events', () => {
    expect(normalizeKey({ key: 'N', code: 'KeyN' })).toBe('n');
  });

  it('returns the lowercase key for special keys', () => {
    expect(normalizeKey({ key: 'Enter', code: 'Enter' })).toBe('enter');
  });

  it('falls back to event.code when event.key is Dead (macOS Alt+letter)', () => {
    expect(normalizeKey({ key: 'Dead', code: 'KeyN' })).toBe('n');
  });

  it('does not fall back to event.code when Dead key is not a letter', () => {
    expect(normalizeKey({ key: 'Dead', code: 'Digit1' })).toBe('dead');
  });

  it('handles already-lowercase keys', () => {
    expect(normalizeKey({ key: 'n', code: 'KeyN' })).toBe('n');
  });
});

describe('matchBinding', () => {
  const bindings = {
    'ctrl+shift+n': () => {},
    'ctrl+alt+n': () => {},
    'ctrl+n': () => {},
    escape: () => {},
  };

  it('matches ctrl+shift binding', () => {
    expect(
      matchBinding(bindings, event({ ctrlKey: true, shiftKey: true }))
    ).toBe('ctrl+shift+n');
  });

  it('matches ctrl+alt binding', () => {
    expect(matchBinding(bindings, event({ ctrlKey: true, altKey: true }))).toBe(
      'ctrl+alt+n'
    );
  });

  it('matches ctrl binding', () => {
    expect(matchBinding(bindings, event({ ctrlKey: true }))).toBe('ctrl+n');
  });

  it('matches metaKey as ctrl (macOS Cmd)', () => {
    expect(matchBinding(bindings, event({ metaKey: true }))).toBe('ctrl+n');
  });

  it('matches single key binding', () => {
    expect(
      matchBinding(bindings, event({ key: 'Escape', code: 'Escape' }))
    ).toBe('escape');
  });

  it('returns null when no binding matches', () => {
    expect(
      matchBinding(bindings, event({ key: 'k', code: 'KeyK' }))
    ).toBeNull();
  });

  it('prefers ctrl+shift over ctrl when both shift and ctrl are pressed', () => {
    expect(
      matchBinding(bindings, event({ ctrlKey: true, shiftKey: true }))
    ).toBe('ctrl+shift+n');
  });

  it('prefers ctrl+alt over ctrl when both alt and ctrl are pressed', () => {
    expect(matchBinding(bindings, event({ ctrlKey: true, altKey: true }))).toBe(
      'ctrl+alt+n'
    );
  });

  it('does not match ctrl binding when shift is held', () => {
    const ctrlOnly = { 'ctrl+n': () => {} };
    expect(
      matchBinding(ctrlOnly, event({ ctrlKey: true, shiftKey: true }))
    ).toBeNull();
  });

  it('handles dead key with ctrl+alt', () => {
    expect(
      matchBinding(
        bindings,
        event({ key: 'Dead', code: 'KeyN', ctrlKey: true, altKey: true })
      )
    ).toBe('ctrl+alt+n');
  });
});
