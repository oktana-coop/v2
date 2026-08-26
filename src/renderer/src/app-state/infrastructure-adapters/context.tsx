import { type Repo as AutomergeRepo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type AssetUrlProtocol,
  type DocumentSharing,
  type ProjectStore,
  type ProjectStoreManager,
} from '../../../../modules/domain/project';
import { createAdapter as createAutomergeDocumentSharingAdapter } from '../../../../modules/domain/project/adapters/automerge-document-sharing';
import {
  createElectronAssetProtocolAdapter,
  createElectronRendererProjectStoreManagerAdapter,
} from '../../../../modules/domain/project/browser';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  type DirectoryWatcher,
  type Filesystem,
} from '../../../../modules/infrastructure/filesystem';
import { createAdapter as createElectronRendererDirectoryWatcherAdapter } from '../../../../modules/infrastructure/filesystem/adapters/directory-watcher/electron-renderer-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../../modules/infrastructure/filesystem/adapters/filesystem/electron-renderer-api';
import {
  createAutomergeRepo,
  SyncServiceError,
} from '../../../../modules/infrastructure/sync';
import { mapErrorTo } from '../../../../utils/errors';
import { LoadingText } from '../../components/progress/LoadingText';

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  directoryWatcher: DirectoryWatcher;
  projectStoreManager: ProjectStoreManager;
  assetUrlProtocol: AssetUrlProtocol;
  projectStore: ProjectStore | null;
  setProjectStore: (store: ProjectStore | null) => void;
  documentSharing: DocumentSharing;
  // The repo that talks to the sync service, and the one that never talks
  // to anyone: documents this app keeps to itself live in the latter.
  syncedRepo: Effect.Effect<AutomergeRepo, SyncServiceError>;
  privateRepo: Effect.Effect<AutomergeRepo>;
};

export const InfrastructureAdaptersContext =
  createContext<InfrastructureAdaptersContextType>({
    // @ts-expect-error will get overriden below
    filesystem: null,
    // @ts-expect-error will get overriden below
    directoryWatcher: null,
    // @ts-expect-error will get overriden below
    projectStoreManager: null,
    // @ts-expect-error will get overriden below
    assetUrlProtocol: null,
    projectStore: null,
    setProjectStore: () => {},
    // @ts-expect-error will get overriden below
    documentSharing: null,
    // @ts-expect-error will get overriden below
    syncedRepo: null,
    // @ts-expect-error will get overriden below
    privateRepo: null,
  });

export const InfrastructureAdaptersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { processId, config } = useContext(ElectronContext);
  const [projectStore, setProjectStore] = useState<ProjectStore | null>(null);

  const filesystem = useMemo(
    () => createElectronRendererFilesystemAPIAdapter(),
    []
  );

  const directoryWatcher = useMemo(
    () => createElectronRendererDirectoryWatcherAdapter(),
    []
  );

  const assetUrlProtocol = useMemo(
    () => createElectronAssetProtocolAdapter(),
    []
  );

  // Private documents live in a repo with no network: they structurally cannot
  // reach the sync service. The repo is created lazily on first use.
  const privateRepoRef = useRef<Promise<AutomergeRepo> | null>(null);
  const privateRepo = useMemo(
    () =>
      Effect.promise(() => {
        if (privateRepoRef.current === null) {
          privateRepoRef.current = Effect.runPromise(createAutomergeRepo({}));
        }

        return privateRepoRef.current;
      }),
    []
  );

  // The synced repo dials the sync service, so it is built on first use rather than
  // on startup: a client that never shares never connects.
  const syncedRepoRef = useRef<Promise<AutomergeRepo> | null>(null);
  const syncedRepo = useMemo(
    () =>
      Effect.tryPromise({
        try: () => {
          // The override lets tests and offline development point at a local
          // sync server without rebuilding.
          const syncServiceUrl =
            localStorage.getItem('syncServiceUrl') ?? config.syncServiceUrl;

          if (syncedRepoRef.current === null) {
            syncedRepoRef.current = Effect.runPromise(
              createAutomergeRepo({ syncServiceUrl })
            );
          }

          return syncedRepoRef.current;
        },
        catch: mapErrorTo(
          SyncServiceError,
          'The sync service could not be started.'
        ),
      }),
    [config.syncServiceUrl]
  );

  const documentSharing = useMemo(
    () =>
      createAutomergeDocumentSharingAdapter({
        syncedRepo,
        onError: console.error,
      }),
    [syncedRepo]
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
        directoryWatcher,
        projectStoreManager,
        assetUrlProtocol,
        projectStore,
        setProjectStore: handleSetProjectStore,
        documentSharing,
        syncedRepo,
        privateRepo,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
