import { createContext, useState, useSyncExternalStore } from 'react';

import {
  createBrowserLocalStorageGuestShareRegistryAdapter,
  type GuestShare,
  type GuestShareRegistry,
} from '../../../../modules/domain/project/browser';

export type GuestShareRegistryContextType = {
  registry: GuestShareRegistry;
  // What the registry holds right now; a change re-renders whoever reads it.
  guestShares: GuestShare[];
};

export const GuestShareRegistryContext =
  createContext<GuestShareRegistryContextType>({
    registry: {
      listShares: () => [],
      rememberShare: () => {},
      forgetShare: () => {},
      labelShare: () => {},
      subscribe: () => () => {},
    },
    guestShares: [],
  });

export const GuestShareRegistryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [registry] = useState(
    createBrowserLocalStorageGuestShareRegistryAdapter
  );
  const guestShares = useSyncExternalStore(
    registry.subscribe,
    registry.listShares
  );

  return (
    <GuestShareRegistryContext.Provider value={{ registry, guestShares }}>
      {children}
    </GuestShareRegistryContext.Provider>
  );
};
