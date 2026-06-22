import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  type AssetUrlProtocol,
  type ProjectStoreManager,
} from '../../../../modules/domain/project';
import {
  createBrowserAutomergeProjectStoreManagerAdapter,
  createElectronAssetProtocolAdapter,
  createElectronRendererAutomergeProjectStoreManagerAdapter,
  createElectronRendererProjectStoreManagerAdapter,
} from '../../../../modules/domain/project/browser';
import { type VersionedDocumentStore } from '../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import { type Filesystem } from '../../../../modules/infrastructure/filesystem';
import { createAdapter as createBrowserFilesystemAPIAdapter } from '../../../../modules/infrastructure/filesystem/adapters/browser-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../../modules/infrastructure/filesystem/adapters/electron-renderer-api';
import { versionControlSystems } from '../../../../modules/infrastructure/version-control';
import { LoadingText } from '../../components/progress/LoadingText';

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  projectStoreManager: ProjectStoreManager;
  assetUrlProtocol: AssetUrlProtocol;
  versionedDocumentStore: VersionedDocumentStore | null;
  setVersionedDocumentStore: (
    documentStore: VersionedDocumentStore | null
  ) => void;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    projectStoreManager: null,
    // @ts-expect-error will get overriden below
    assetUrlProtocol: null,
    versionedDocumentStore: null,
    setVersionedDocumentStore: () => {},
  });

export const InfrastructureAdaptersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { processId, isElectron, config } = useContext(ElectronContext);
  const [versionedDocumentStore, setVersionedDocumentStore] =
    useState<VersionedDocumentStore | null>(null);

  const filesystem = isElectron
    ? createElectronRendererFilesystemAPIAdapter()
    : createBrowserFilesystemAPIAdapter();

  // TODO: Browser build will need its own AssetUrlProtocol adapter.
  const assetUrlProtocol = createElectronAssetProtocolAdapter();

  const [projectStoreManager, setProjectStoreManager] =
    useState<ProjectStoreManager | null>(null);

  useEffect(() => {
    const setupProjectStoreManagers = async () => {
      if (isElectron) {
        if (processId) {
          const multiDocProjectStoreManager =
            config.projectVersionControlSystem ===
            versionControlSystems.AUTOMERGE
              ? createElectronRendererAutomergeProjectStoreManagerAdapter({
                  processId,
                })
              : // Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
                createElectronRendererProjectStoreManagerAdapter();

          setProjectStoreManager(multiDocProjectStoreManager);
        }
      } else {
        // Only Automerge is supported in browser environment for now
        const multiDocProjectStoreManager =
          createBrowserAutomergeProjectStoreManagerAdapter();
        setProjectStoreManager(multiDocProjectStoreManager);
      }
    };

    setupProjectStoreManagers();
  }, [processId, isElectron]);

  if (!projectStoreManager) {
    // TODO: Replace with skeleton or spinner
    return <LoadingText />;
  }

  const handleSetDocumentStore = async (
    documentStore: VersionedDocumentStore | null
  ) => {
    if (versionedDocumentStore) {
      await Effect.runPromise(versionedDocumentStore.disconnect());
    }
    setVersionedDocumentStore(documentStore);
  };

  return (
    <InfrastructureAdaptersContext.Provider
      value={{
        filesystem,
        projectStoreManager,
        assetUrlProtocol,
        versionedDocumentStore,
        setVersionedDocumentStore: handleSetDocumentStore,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
