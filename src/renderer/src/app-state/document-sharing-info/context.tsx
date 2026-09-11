import { createContext, useCallback, useMemo, useState } from 'react';

import { type ShareUrl } from '../../../../modules/domain/project';
import {
  type DocumentShareKey,
  documentShareStorageKey,
  readStoredShares,
  removeStoredShare,
  storeShare,
} from './browser-storage';

export type DocumentSharingInfoContextType = {
  shareUrlFor: (key: DocumentShareKey) => ShareUrl | null;
  rememberShare: (args: DocumentShareKey & { shareUrl: ShareUrl }) => void;
  forgetShare: (key: DocumentShareKey) => void;
};

export const DocumentSharingInfoContext =
  createContext<DocumentSharingInfoContextType>({
    shareUrlFor: () => null,
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
    useState<Record<string, ShareUrl>>(readStoredShares);

  const shareUrlFor = useCallback(
    (key: DocumentShareKey) => shares[documentShareStorageKey(key)] ?? null,
    [shares]
  );

  const rememberShare = useCallback(
    ({ shareUrl, ...key }: DocumentShareKey & { shareUrl: ShareUrl }) => {
      storeShare(key, shareUrl);
      setShares((current) => ({
        ...current,
        [documentShareStorageKey(key)]: shareUrl,
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
    () => ({ shareUrlFor, rememberShare, forgetShare }),
    [shareUrlFor, rememberShare, forgetShare]
  );

  return (
    <DocumentSharingInfoContext.Provider value={value}>
      {children}
    </DocumentSharingInfoContext.Provider>
  );
};
