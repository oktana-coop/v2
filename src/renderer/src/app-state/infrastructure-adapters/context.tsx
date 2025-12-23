import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  type MultiDocumentProjectStoreManager,
  type SingleDocumentProjectStoreManager,
} from '../../../../modules/domain/project';
import {
  createBrowserAutomergeMultiDocumentProjectStoreManagerAdapter,
  createBrowserAutomergeSingleDocumentProjectStoreManagerAdapter,
  createElectronRendererAutomergeMultiDocumentProjectStoreManagerAdapter,
  createElectronRendererAutomergeSingleDocumentProjectStoreManagerAdapter,
  createElectronRendererIpcSingleDocumentProjectStoreManagerAdapter,
  createElectronRendererMultiDocumentProjectStoreManagerAdapter,
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
  singleDocumentProjectStoreManager: SingleDocumentProjectStoreManager;
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
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
  const { processId, isElectron, config } = useContext(ElectronContext);
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
            config.singleDocumentProjectVersionControlSystem ===
            versionControlSystems.AUTOMERGE
              ? createElectronRendererAutomergeSingleDocumentProjectStoreManagerAdapter(
                  { processId }
                )
              : // Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
                createElectronRendererIpcSingleDocumentProjectStoreManagerAdapter();

          const multiDocProjectStoreManager =
            config.singleDocumentProjectVersionControlSystem ===
            versionControlSystems.AUTOMERGE
              ? createElectronRendererAutomergeMultiDocumentProjectStoreManagerAdapter(
                  { processId }
                )
              : // Currently used for Git. This adapter is really generic, it just delegates to the main process via IPC.
                createElectronRendererMultiDocumentProjectStoreManagerAdapter();

          setSingleDocumentProjectStoreManager(singleDocProjectStoreManager);
          setMultiDocumentProjectStoreManager(multiDocProjectStoreManager);
        }
      } else {
        // Only Automerge is supported in browser environment for now
        const singleDocProjectStoreManager =
          createBrowserAutomergeSingleDocumentProjectStoreManagerAdapter();
        const multiDocProjectStoreManager =
          createBrowserAutomergeMultiDocumentProjectStoreManagerAdapter();
        setSingleDocumentProjectStoreManager(singleDocProjectStoreManager);
        setMultiDocumentProjectStoreManager(multiDocProjectStoreManager);
      }
    };

    setupProjectStoreManagers();
  }, [processId, isElectron]);

  if (!singleDocumentProjectStoreManager || !multiDocumentProjectStoreManager) {
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
