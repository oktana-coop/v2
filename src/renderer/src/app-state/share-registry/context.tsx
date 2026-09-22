import { createContext, useState, useSyncExternalStore } from 'react';

import {
  createBrowserLocalStorageShareRegistryAdapter,
  type RegisteredShare,
  type ShareRegistry,
} from '../../../../modules/domain/project/browser';

export type ShareRegistryContextType = {
  registry: ShareRegistry;
  // What the registry holds right now; a change re-renders whoever reads it.
  shares: RegisteredShare[];
};

export const ShareRegistryContext = createContext<ShareRegistryContextType>({
  registry: {
    listShares: () => [],
    findShareId: () => null,
    isShared: () => false,
    rememberShare: () => {},
    forgetShare: () => {},
    subscribe: () => () => {},
  },
  shares: [],
});

export const ShareRegistryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [registry] = useState(createBrowserLocalStorageShareRegistryAdapter);
  const shares = useSyncExternalStore(registry.subscribe, registry.listShares);

  return (
    <ShareRegistryContext.Provider value={{ registry, shares }}>
      {children}
    </ShareRegistryContext.Provider>
  );
};
