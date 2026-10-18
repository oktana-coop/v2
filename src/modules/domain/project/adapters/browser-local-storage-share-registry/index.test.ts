import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../infrastructure/version-control';
import { type ProjectId } from '../../models';
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

const key = {
  projectId: '/projects/one' as ProjectId,
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
};

const otherKey = { ...key, documentId: '/blob/main/other.md' as ArtifactId };

describe('browser local storage share registry', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('knows nothing of a document until a share is remembered', () => {
    const registry = createAdapter();

    expect(registry.findShareId(key)).toBeNull();
    expect(registry.isShared(key)).toBe(false);
    expect(registry.listShares()).toEqual([]);
  });

  it('finds a remembered share by its key', () => {
    const registry = createAdapter();

    registry.rememberShare({ key, shareId: 'automerge:a' });

    expect(registry.findShareId(key)).toBe('automerge:a');
    expect(registry.isShared(key)).toBe(true);
    expect(registry.isShared({ ...key, branch: 'other' as Branch })).toBe(
      false
    );
  });

  it('keeps one share per document, the latest remembered', () => {
    const registry = createAdapter();

    registry.rememberShare({ key, shareId: 'automerge:a' });
    registry.rememberShare({ key, shareId: 'automerge:b' });

    expect(registry.listShares()).toEqual([{ key, shareId: 'automerge:b' }]);
  });

  it('reads back what an earlier adapter wrote', () => {
    createAdapter().rememberShare({ key, shareId: 'automerge:a' });
    createAdapter().rememberShare({ key: otherKey, shareId: 'automerge:b' });

    expect(createAdapter().listShares()).toEqual([
      { key, shareId: 'automerge:a' },
      { key: otherKey, shareId: 'automerge:b' },
    ]);
  });

  it('leaves out a share it cannot read', () => {
    localStorage.setItem(
      'shares',
      JSON.stringify([
        { shareId: 3 },
        { key: { ...key, projectId: '' }, shareId: 'automerge:b' },
        { key, shareId: 'automerge:a' },
      ])
    );

    expect(createAdapter().listShares()).toEqual([
      { key, shareId: 'automerge:a' },
    ]);
  });

  it('reads nothing from a value it cannot parse', () => {
    localStorage.setItem('shares', 'not json');

    expect(createAdapter().listShares()).toEqual([]);
  });

  it('forgets a share', () => {
    const registry = createAdapter();

    registry.rememberShare({ key, shareId: 'automerge:a' });
    registry.forgetShare(key);

    expect(registry.findShareId(key)).toBeNull();
    expect(createAdapter().listShares()).toEqual([]);
  });

  it('tells a subscriber after each change, until it unsubscribes', () => {
    const registry = createAdapter();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.rememberShare({ key, shareId: 'automerge:a' });
    registry.forgetShare(key);
    unsubscribe();
    registry.rememberShare({ key, shareId: 'automerge:a' });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
