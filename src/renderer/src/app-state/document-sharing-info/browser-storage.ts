import {
  type ProjectId,
  type ShareUrl,
} from '../../../../modules/domain/project';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';

const STORAGE_KEY_PREFIX = 'share';

// Which document, on which branch, this client is sharing. The branch is part
// of the key rather than read out of the document id, which is opaque.
export type DocumentShareKey = {
  projectId: ProjectId;
  branch: Branch;
  documentId: ArtifactId;
};

export const documentShareStorageKey = ({
  projectId,
  branch,
  documentId,
}: DocumentShareKey) =>
  `${STORAGE_KEY_PREFIX}:${projectId}:${branch}:${documentId}`;

export const readStoredShares = (): Record<string, ShareUrl> => {
  const shares: Record<string, ShareUrl> = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) continue;

    const shareUrl = localStorage.getItem(key);

    if (shareUrl) shares[key] = shareUrl;
  }

  return shares;
};

export const storeShare = (key: DocumentShareKey, shareUrl: ShareUrl) =>
  localStorage.setItem(documentShareStorageKey(key), shareUrl);

export const removeStoredShare = (key: DocumentShareKey) =>
  localStorage.removeItem(documentShareStorageKey(key));
