import { z } from 'zod';

import {
  artifactIdSchema,
  branchSchema,
} from '../../../../infrastructure/version-control';
import { projectIdSchema } from '../../models';
import {
  type DocumentShareKey,
  type RegisteredShare,
  type ShareRegistry,
} from '../../ports';

const STORAGE_KEY = 'shares';

const storedShareSchema = z.object({
  key: z.object({
    projectId: projectIdSchema,
    branch: branchSchema,
    documentId: artifactIdSchema,
  }),
  shareId: z.string(),
});

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const readableShares = (entry: unknown): RegisteredShare[] => {
  const parsed = storedShareSchema.safeParse(entry);

  return parsed.success ? [parsed.data] : [];
};

const readStoredShares = (): RegisteredShare[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const value = stored === null ? [] : parseJson(stored);

  return Array.isArray(value) ? value.flatMap(readableShares) : [];
};

const writeStoredShares = (shares: ReadonlyArray<RegisteredShare>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));

const isSameKey = (a: DocumentShareKey, b: DocumentShareKey) =>
  a.projectId === b.projectId &&
  a.branch === b.branch &&
  a.documentId === b.documentId;

// One value holding every share, read once and written whole after each
// change, which is then told to whoever subscribed.
export const createAdapter = (): ShareRegistry => {
  let shares = readStoredShares();
  const listeners = new Set<() => void>();

  const update = (next: RegisteredShare[]) => {
    shares = next;
    writeStoredShares(shares);
    listeners.forEach((listener) => listener());
  };

  const findShareId: ShareRegistry['findShareId'] = (key) =>
    shares.find((share) => isSameKey(share.key, key))?.shareId ?? null;

  return {
    listShares: () => shares,
    findShareId,
    isShared: (key) => findShareId(key) !== null,
    rememberShare: (share) =>
      update([
        ...shares.filter((known) => !isSameKey(known.key, share.key)),
        share,
      ]),
    forgetShare: (key) =>
      update(shares.filter((known) => !isSameKey(known.key, key))),
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
