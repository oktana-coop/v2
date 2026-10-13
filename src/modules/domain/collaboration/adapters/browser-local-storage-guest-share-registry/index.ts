import { z } from 'zod';

import { type GuestShareRegistry } from '../../ports';
import {
  createOrRefreshGuestShare,
  labelGuestShare,
  replaceOrPrependGuestShare,
  type StoredGuestShare,
  toGuestShare,
} from './guest-share';

const STORAGE_KEY = 'guest-shares';

const storedGuestShareSchema = z.object({
  shareId: z.string(),
  sharedName: z.string(),
  label: z.string().nullable(),
  lastOpenedAt: z.number(),
});

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const readableShares = (entry: unknown): StoredGuestShare[] => {
  const parsed = storedGuestShareSchema.safeParse(entry);

  return parsed.success ? [parsed.data] : [];
};

const newestFirst = (a: StoredGuestShare, b: StoredGuestShare) =>
  b.lastOpenedAt - a.lastOpenedAt;

const readStoredShares = (): StoredGuestShare[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const value = stored === null ? [] : parseJson(stored);

  return Array.isArray(value)
    ? value.flatMap(readableShares).sort(newestFirst)
    : [];
};

const writeStoredShares = (shares: ReadonlyArray<StoredGuestShare>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));

export const createAdapter = (): GuestShareRegistry => {
  let stored = readStoredShares();
  let shares = stored.map(toGuestShare);
  const listeners = new Set<() => void>();

  const update = (next: StoredGuestShare[]) => {
    stored = next;
    shares = next.map(toGuestShare);
    writeStoredShares(stored);
    listeners.forEach((listener) => listener());
  };

  const findStored = (shareId: string) =>
    stored.find((entry) => entry.shareId === shareId);

  return {
    listShares: () => shares,
    rememberShare: ({ shareId, sharedName }) =>
      update(
        replaceOrPrependGuestShare({
          current: stored,
          share: createOrRefreshGuestShare({
            existing: findStored(shareId),
            shareId,
            sharedName,
            openedAt: Date.now(),
          }),
        })
      ),
    forgetShare: (shareId) =>
      update(stored.filter((entry) => entry.shareId !== shareId)),
    labelShare: ({ shareId, label }) => {
      const existing = findStored(shareId);

      if (!existing) return;

      update(
        replaceOrPrependGuestShare({
          current: stored,
          share: labelGuestShare({ share: existing, label }),
        })
      );
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
