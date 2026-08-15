import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { buildConfig } from '../../../../modules/config';
import {
  type AssetUrlProtocol,
  type ProjectStore,
  type ProjectStoreManager,
  type ProjectSync,
} from '../../../../modules/domain/project';
import { createAdapter as createAutomergeProjectSyncAdapter } from '../../../../modules/domain/project/adapters/automerge-project-sync';
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
import { createAutomergeRepo } from '../../../../modules/infrastructure/sync';
import { LoadingText } from '../../components/progress/LoadingText';

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  directoryWatcher: DirectoryWatcher;
  projectStoreManager: ProjectStoreManager;
  assetUrlProtocol: AssetUrlProtocol;
  projectStore: ProjectStore | null;
  setProjectStore: (store: ProjectStore | null) => void;
  projectSync: ProjectSync;
  // The repo that talks to the sync service, and the one that never talks
  // to anyone: private documents live in the latter.
  getSyncedRepo: () => Promise<Repo>;
  getHostRepo: () => Promise<Repo>;
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
    projectSync: null,
    // @ts-expect-error will get overriden below
    getSyncedRepo: null,
    // @ts-expect-error will get overriden below
    getHostRepo: null,
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

  const directoryWatcher = useMemo(
    () => createElectronRendererDirectoryWatcherAdapter(),
    []
  );

  const assetUrlProtocol = useMemo(
    () => createElectronAssetProtocolAdapter(),
    []
  );

  // The repo dials the sync service, so it is built on first use rather than
  // on startup: a client that never shares never connects.
  const syncedRepoRef = useRef<Promise<Repo> | null>(null);
  const getSyncedRepo = useCallback(() => {
    // The override lets tests and offline development point at a local sync
    // server without rebuilding.
    const syncServiceUrl =
      localStorage.getItem('syncServiceUrl') ?? buildConfig.syncServiceUrl;

    syncedRepoRef.current ??= Effect.runPromise(
      createAutomergeRepo({ syncServiceUrl })
    );

    return syncedRepoRef.current;
  }, []);

  // Private documents live in their own repo with no network: they
  // structurally cannot reach the sync service.
  const hostRepoRef = useRef<Promise<Repo> | null>(null);
  const getHostRepo = useCallback(() => {
    hostRepoRef.current ??= Effect.runPromise(createAutomergeRepo({}));

    return hostRepoRef.current;
  }, []);

  const projectSync = useMemo(
    (): ProjectSync => ({
      shareDocument: (args) =>
        pipe(
          Effect.promise(getSyncedRepo),
          Effect.flatMap((repo) =>
            createAutomergeProjectSyncAdapter({ repo }).shareDocument(args)
          )
        ),
      leaveSharedDocument: (args) =>
        pipe(
          Effect.promise(getSyncedRepo),
          Effect.flatMap((repo) =>
            createAutomergeProjectSyncAdapter({ repo }).leaveSharedDocument(
              args
            )
          )
        ),
    }),
    [getSyncedRepo]
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
        projectSync,
        getSyncedRepo,
        getHostRepo,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
