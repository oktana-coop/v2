import { createContext, useMemo, useState } from 'react';

import {
  createBrowserLocalStorageShareRegistryAdapter,
  type ShareRegistry,
} from '../../../../modules/domain/project/browser';

export const ShareRegistryContext = createContext<ShareRegistry>({
  findShareId: () => null,
  isShared: () => false,
  rememberShare: () => {},
  forgetShare: () => {},
});

// The shares this client takes part in, read from the browser's storage. A
// change hands out a new registry, so whatever was derived from the old one
// is derived again.
export const ShareRegistryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [adapter] = useState(createBrowserLocalStorageShareRegistryAdapter);
  const [version, setVersion] = useState(0);

  const registry = useMemo(
    (): ShareRegistry => ({
      findShareId: adapter.findShareId,
      isShared: adapter.isShared,
      rememberShare: (key, shareId) => {
        adapter.rememberShare(key, shareId);
        setVersion((current) => current + 1);
      },
      forgetShare: (key) => {
        adapter.forgetShare(key);
        setVersion((current) => current + 1);
      },
    }),
    // The version is what makes a change hand out a new registry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, version]
  );

  return (
    <ShareRegistryContext.Provider value={registry}>
      {children}
    </ShareRegistryContext.Provider>
  );
};
