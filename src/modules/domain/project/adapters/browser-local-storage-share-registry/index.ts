import { type DocumentShareKey, type ShareRegistry } from '../../ports';

const STORAGE_KEY_PREFIX = 'share';

export const documentShareStorageKey = ({
  projectId,
  branch,
  documentId,
}: DocumentShareKey) =>
  `${STORAGE_KEY_PREFIX}:${projectId}:${branch}:${documentId}`;

export const createAdapter = (): ShareRegistry => {
  const findShareId: ShareRegistry['findShareId'] = (key) =>
    localStorage.getItem(documentShareStorageKey(key));

  return {
    findShareId,
    isShared: (key) => findShareId(key) !== null,
    rememberShare: (key, shareId) =>
      localStorage.setItem(documentShareStorageKey(key), shareId),
    forgetShare: (key) => localStorage.removeItem(documentShareStorageKey(key)),
  };
};
