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
  });

  it('finds a remembered share by its key', () => {
    const registry = createAdapter();

    registry.rememberShare(key, 'automerge:a');

    expect(registry.findShareId(key)).toBe('automerge:a');
    expect(registry.isShared(key)).toBe(true);
    expect(registry.isShared({ ...key, branch: 'other' as Branch })).toBe(
      false
    );
  });

  it('forgets a share', () => {
    const registry = createAdapter();

    registry.rememberShare(key, 'automerge:a');
    registry.forgetShare(key);

    expect(registry.findShareId(key)).toBeNull();
  });
});
