import { createContext, useCallback, useMemo, useState } from 'react';

import { type ShareId } from '../../../../modules/domain/project';
import {
  type DocumentShareKey,
  documentShareStorageKey,
  readStoredShares,
  removeStoredShare,
  storeShare,
} from './browser-storage';

export type DocumentSharingInfoContextType = {
  shareIdFor: (key: DocumentShareKey) => ShareId | null;
  rememberShare: (args: DocumentShareKey & { shareId: ShareId }) => void;
  forgetShare: (key: DocumentShareKey) => void;
};

export const DocumentSharingInfoContext =
  createContext<DocumentSharingInfoContextType>({
    shareIdFor: () => null,
    rememberShare: () => {},
    forgetShare: () => {},
  });

// Which shares this client takes part in. Losing it loses no content: the
// shared documents live with their peers, and pasting a link joins again.
export const DocumentSharingInfoProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [shares, setShares] =
    useState<Record<string, ShareId>>(readStoredShares);

  const shareIdFor = useCallback(
    (key: DocumentShareKey) => shares[documentShareStorageKey(key)] ?? null,
    [shares]
  );

  const rememberShare = useCallback(
    ({ shareId, ...key }: DocumentShareKey & { shareId: ShareId }) => {
      storeShare(key, shareId);
      setShares((current) => ({
        ...current,
        [documentShareStorageKey(key)]: shareId,
      }));
    },
    []
  );

  const forgetShare = useCallback((key: DocumentShareKey) => {
    removeStoredShare(key);
    setShares((current) => {
      const remaining = { ...current };
      delete remaining[documentShareStorageKey(key)];

      return remaining;
    });
  }, []);

  const value = useMemo(
    () => ({ shareIdFor, rememberShare, forgetShare }),
    [shareIdFor, rememberShare, forgetShare]
  );

  return (
    <DocumentSharingInfoContext.Provider value={value}>
      {children}
    </DocumentSharingInfoContext.Provider>
  );
};
