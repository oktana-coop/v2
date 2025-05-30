import { createContext, useContext, useEffect, useState } from 'react';

import {
  createAutomergeProjectStoreAdapter,
  type VersionedProjectStore,
} from '../../../modules/domain/project';
import {
  createAutomergeDocumentStoreAdapter,
  type VersionedDocumentStore,
} from '../../../modules/domain/rich-text';
import { ElectronContext } from '../../../modules/infrastructure/cross-platform/electron-context';
import { type Filesystem } from '../../../modules/infrastructure/filesystem';
import { createAdapter as createBrowserFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/browser-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../modules/infrastructure/filesystem/adapters/electron-renderer-api';
import { type AutomergeRepo } from '../../../modules/infrastructure/version-control';
import {
  setupForElectron as setupBrowserRepoForElectron,
  setupForWeb as setupBrowserRepoForWeb,
} from '../../../modules/infrastructure/version-control/automerge-repo/browser';

type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  versionedProjectStore: VersionedProjectStore;
  versionedDocumentStore: VersionedDocumentStore;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    versionedProjectStore: null,
    // @ts-expect-error will get overriden below
    versionedDocumentStore: null,
  });

export const InfrastructureAdaptersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { processId, isElectron } = useContext(ElectronContext);

  const filesystem = isElectron
    ? createElectronRendererFilesystemAPIAdapter()
    : createBrowserFilesystemAPIAdapter();

  const [versionedProjectStore, setVersionedProjectStore] =
    useState<VersionedProjectStore | null>(null);
  const [versionedDocumentStore, setVersionedDocumentStore] =
    useState<VersionedDocumentStore | null>(null);

  useEffect(() => {
    const setupVersionControlRepo = async () => {
      const setupStores = (automergeRepo: AutomergeRepo) => {
        const versionedProjectStore =
          createAutomergeProjectStoreAdapter(automergeRepo);
        const versionedDocumentStore =
          createAutomergeDocumentStoreAdapter(automergeRepo);

        setVersionedProjectStore(versionedProjectStore);
        setVersionedDocumentStore(versionedDocumentStore);
      };

      if (isElectron) {
        if (processId) {
          const automergeRepo = await setupBrowserRepoForElectron(processId);
          setupStores(automergeRepo);
        }
      } else {
        const automergeRepo = await setupBrowserRepoForWeb();
        setupStores(automergeRepo);
      }
    };

    setupVersionControlRepo();
  }, [processId, isElectron]);

  if (!versionedDocumentStore || !versionedProjectStore) {
    // TODO: Replace with skeleton or spinner
    return <div>Loading...</div>;
  }

  return (
    <InfrastructureAdaptersContext.Provider
      value={{
        filesystem,
        versionedProjectStore,
        versionedDocumentStore,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
