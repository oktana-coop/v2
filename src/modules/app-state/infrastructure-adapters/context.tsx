import { createContext, useContext, useEffect, useState } from 'react';

import { type SingleDocumentProjectStoreManager } from '../../../modules/domain/project';
import { type VersionedDocumentStore } from '../../../modules/domain/rich-text';
import { ElectronContext } from '../../../modules/infrastructure/cross-platform/electron-context';
import { type Filesystem } from '../../../modules/infrastructure/filesystem';
import { createAdapter as createBrowserFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/browser-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/electron-renderer-api';
import { createAdapter as createBrowserProjectStoreManagerAdapter } from '../../domain/project/adapters/single-document-project/automerge-project-store-manager/browser';
import { createAdapter as createElectronRendererProjectStoreManagerAdapter } from '../../domain/project/adapters/single-document-project/automerge-project-store-manager/electron-renderer';

type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  projectStoreManager: SingleDocumentProjectStoreManager;
  versionedDocumentStore: VersionedDocumentStore | null;
  setVersionedDocumentStore: (documentStore: VersionedDocumentStore) => void;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    projectStoreManager: null,
    versionedDocumentStore: null,
    setVersionedDocumentStore: () => {},
  });

export const InfrastructureAdaptersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { processId, isElectron } = useContext(ElectronContext);
  const [versionedDocumentStore, setVersionedDocumentStore] =
    useState<VersionedDocumentStore | null>(null);

  const filesystem = isElectron
    ? createElectronRendererFilesystemAPIAdapter()
    : createBrowserFilesystemAPIAdapter();

  const [projectStoreManager, setProjectStoreManager] =
    useState<SingleDocumentProjectStoreManager | null>(null);

  useEffect(() => {
    const setupProjectStoreManager = async () => {
      if (isElectron) {
        if (processId) {
          const storeManager = createElectronRendererProjectStoreManagerAdapter(
            { processId }
          );
          setProjectStoreManager(storeManager);
        }
      } else {
        const storeManager = createBrowserProjectStoreManagerAdapter();
        setProjectStoreManager(storeManager);
      }
    };

    setupProjectStoreManager();
  }, [processId, isElectron]);

  if (!projectStoreManager) {
    // TODO: Replace with skeleton or spinner
    return <div>Loading...</div>;
  }

  const handleSetDocumentStore = (documentStore: VersionedDocumentStore) => {
    setVersionedDocumentStore(documentStore);
  };

  return (
    <InfrastructureAdaptersContext.Provider
      value={{
        filesystem,
        projectStoreManager,
        versionedDocumentStore,
        setVersionedDocumentStore: handleSetDocumentStore,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
