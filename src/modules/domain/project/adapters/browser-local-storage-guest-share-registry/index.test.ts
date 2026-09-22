import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdapter } from '.';

// The test environment has no web storage; this is the part of it the
// adapter uses.
const createMemoryStorage = (): Storage => {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
    removeItem: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };
};

const openedAt = (time: number) => vi.spyOn(Date, 'now').mockReturnValue(time);

const stored = (shareId: string, lastOpenedAt: number) => ({
  shareId,
  sharedName: shareId,
  label: null,
  lastOpenedAt,
});

describe('browser local storage guest share registry', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists nothing until a share is remembered', () => {
    expect(createAdapter().listShares()).toEqual([]);
  });

  it('puts a newly remembered share at the top, called as the share is', () => {
    const registry = createAdapter();

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });
    openedAt(2);
    registry.rememberShare({ shareId: 'automerge:b', sharedName: 'b' });

    expect(registry.listShares()).toEqual([
      { shareId: 'automerge:b', name: 'b', lastOpenedAt: 2 },
      { shareId: 'automerge:a', name: 'a', lastOpenedAt: 1 },
    ]);
  });

  it('keeps an opened share where it is, following the share name', () => {
    const registry = createAdapter();

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });
    openedAt(2);
    registry.rememberShare({ shareId: 'automerge:b', sharedName: 'b' });
    openedAt(3);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'renamed' });

    expect(registry.listShares()).toEqual([
      { shareId: 'automerge:b', name: 'b', lastOpenedAt: 2 },
      { shareId: 'automerge:a', name: 'renamed', lastOpenedAt: 3 },
    ]);
  });

  it('reads back what an earlier adapter wrote, newest opened first', () => {
    const registry = createAdapter();

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });
    openedAt(2);
    registry.rememberShare({ shareId: 'automerge:b', sharedName: 'b' });
    openedAt(3);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });

    expect(createAdapter().listShares()).toEqual([
      { shareId: 'automerge:a', name: 'a', lastOpenedAt: 3 },
      { shareId: 'automerge:b', name: 'b', lastOpenedAt: 2 },
    ]);
  });

  it('calls a share by its label once given one, until the label is blank', () => {
    const registry = createAdapter();

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'note' });
    registry.labelShare({ shareId: 'automerge:a', label: ' mine ' });

    expect(registry.listShares()[0]?.name).toBe('mine');

    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'renamed' });

    expect(registry.listShares()[0]?.name).toBe('mine');
    expect(createAdapter().listShares()[0]?.name).toBe('mine');

    registry.labelShare({ shareId: 'automerge:a', label: '  ' });

    expect(registry.listShares()[0]?.name).toBe('renamed');
  });

  it('labels nothing it does not hold', () => {
    const registry = createAdapter();

    registry.labelShare({ shareId: 'automerge:a', label: 'mine' });

    expect(registry.listShares()).toEqual([]);
  });

  it('forgets a share', () => {
    const registry = createAdapter();

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });
    registry.forgetShare('automerge:a');

    expect(registry.listShares()).toEqual([]);
    expect(createAdapter().listShares()).toEqual([]);
  });

  it('leaves out an entry it cannot read', () => {
    localStorage.setItem(
      'guest-shares',
      JSON.stringify([{ sharedName: 3 }, stored('automerge:a', 1)])
    );

    expect(createAdapter().listShares()).toEqual([
      { shareId: 'automerge:a', name: 'automerge:a', lastOpenedAt: 1 },
    ]);
  });

  it('reads nothing from a value it cannot parse', () => {
    localStorage.setItem('guest-shares', 'not json');

    expect(createAdapter().listShares()).toEqual([]);
  });

  it('reads nothing from a value that is not a list', () => {
    localStorage.setItem('guest-shares', JSON.stringify({ shares: [] }));

    expect(createAdapter().listShares()).toEqual([]);
  });

  it('tells a subscriber after each change, until it unsubscribes', () => {
    const registry = createAdapter();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    openedAt(1);
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });
    registry.labelShare({ shareId: 'automerge:a', label: 'mine' });
    registry.forgetShare('automerge:a');
    unsubscribe();
    registry.rememberShare({ shareId: 'automerge:a', sharedName: 'a' });

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
