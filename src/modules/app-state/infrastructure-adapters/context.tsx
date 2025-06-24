import { createContext, useContext, useEffect, useState } from 'react';

import {
  type MultiDocumentProjectStoreManager,
  type SingleDocumentProjectStoreManager,
} from '../../../modules/domain/project';
import { type VersionedDocumentStore } from '../../../modules/domain/rich-text';
import { ElectronContext } from '../../../modules/infrastructure/cross-platform/electron-context';
import { type Filesystem } from '../../../modules/infrastructure/filesystem';
import { createAdapter as createBrowserFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/browser-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/electron-renderer-api';
import {
  createBrowserMultiDocumentProjectStoreManagerAdapter,
  createBrowserSingleDocumentProjectStoreManagerAdapter,
  createElectronRendererMultiDocumentProjectStoreManagerAdapter,
  createElectronRendererSingleDocumentProjectStoreManagerAdapter,
} from '../../domain/project/browser';

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  singleDocumentProjectStoreManager: SingleDocumentProjectStoreManager;
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
  versionedDocumentStore: VersionedDocumentStore | null;
  setVersionedDocumentStore: (documentStore: VersionedDocumentStore) => void;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    singleDocumentProjectStoreManager: null,
    // @ts-expect-error will get overriden below
    multiDocumentProjectStoreManager: null,
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

  const [
    singleDocumentProjectStoreManager,
    setSingleDocumentProjectStoreManager,
  ] = useState<SingleDocumentProjectStoreManager | null>(null);

  const [
    multiDocumentProjectStoreManager,
    setMultiDocumentProjectStoreManager,
  ] = useState<MultiDocumentProjectStoreManager | null>(null);

  useEffect(() => {
    const setupProjectStoreManagers = async () => {
      if (isElectron) {
        if (processId) {
          const singleDocProjectStoreManager =
            createElectronRendererSingleDocumentProjectStoreManagerAdapter({
              processId,
            });
          const multiDocProjectStoreManager =
            createElectronRendererMultiDocumentProjectStoreManagerAdapter({
              processId,
            });
          setSingleDocumentProjectStoreManager(singleDocProjectStoreManager);
          setMultiDocumentProjectStoreManager(multiDocProjectStoreManager);
        }
      } else {
        const singleDocProjectStoreManager =
          createBrowserSingleDocumentProjectStoreManagerAdapter();
        const multiDocProjectStoreManager =
          createBrowserMultiDocumentProjectStoreManagerAdapter();
        setSingleDocumentProjectStoreManager(singleDocProjectStoreManager);
        setMultiDocumentProjectStoreManager(multiDocProjectStoreManager);
      }
    };

    setupProjectStoreManagers();
  }, [processId, isElectron]);

  if (!singleDocumentProjectStoreManager || !multiDocumentProjectStoreManager) {
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
        singleDocumentProjectStoreManager,
        multiDocumentProjectStoreManager,
        versionedDocumentStore,
        setVersionedDocumentStore: handleSetDocumentStore,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
