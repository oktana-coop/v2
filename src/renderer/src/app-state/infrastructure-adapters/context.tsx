import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  type AssetUrlProtocol,
  type ProjectStore,
  type ProjectStoreManager,
} from '../../../../modules/domain/project';
import {
  createElectronAssetProtocolAdapter,
  createElectronRendererProjectStoreManagerAdapter,
} from '../../../../modules/domain/project/browser';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import { type Filesystem } from '../../../../modules/infrastructure/filesystem';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../../modules/infrastructure/filesystem/adapters/electron-renderer-api';
import { LoadingText } from '../../components/progress/LoadingText';

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  projectStoreManager: ProjectStoreManager;
  assetUrlProtocol: AssetUrlProtocol;
  projectStore: ProjectStore | null;
  setProjectStore: (store: ProjectStore | null) => void;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    projectStoreManager: null,
    // @ts-expect-error will get overriden below
    assetUrlProtocol: null,
    projectStore: null,
    setProjectStore: () => {},
  });

export const InfrastructureAdaptersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { processId } = useContext(ElectronContext);
  const [projectStore, setProjectStore] = useState<ProjectStore | null>(null);

  const filesystem = useMemo(
    () => createElectronRendererFilesystemAPIAdapter(),
    []
  );

  const assetUrlProtocol = useMemo(
    () => createElectronAssetProtocolAdapter(),
    []
  );

  const [projectStoreManager, setProjectStoreManager] =
    useState<ProjectStoreManager | null>(null);

  useEffect(() => {
    if (processId) {
      // This adapter just delegates to the main process via IPC.
      setProjectStoreManager(
        createElectronRendererProjectStoreManagerAdapter()
      );
    }
  }, [processId]);

  if (!projectStoreManager) {
    // TODO: Replace with skeleton or spinner
    return <LoadingText />;
  }

  const handleSetProjectStore = (store: ProjectStore | null) => {
    setProjectStore(store);
  };

  return (
    <InfrastructureAdaptersContext.Provider
      value={{
        filesystem,
        projectStoreManager,
        assetUrlProtocol,
        projectStore,
        setProjectStore: handleSetProjectStore,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
