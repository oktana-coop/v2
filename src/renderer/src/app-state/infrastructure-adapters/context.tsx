import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { buildConfig } from '../../../../modules/config';
import {
  type AssetUrlProtocol,
  type DocumentSharing,
  type ProjectStore,
  type ProjectStoreManager,
  SharedDocumentUnavailableError,
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
  syncedRepo: Effect.Effect<Repo, SyncServiceError>;
  privateRepo: Effect.Effect<Repo>;
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
  const syncedRepo = useMemo(
    () =>
      Effect.tryPromise({
        try: () => {
          // The override lets tests and offline development point at a local
          // sync server without rebuilding.
          const syncServiceUrl =
            localStorage.getItem('syncServiceUrl') ??
            buildConfig.syncServiceUrl;

          syncedRepoRef.current ??= Effect.runPromise(
            createAutomergeRepo({ syncServiceUrl })
          );

          return syncedRepoRef.current;
        },
        catch: mapErrorTo(
          SyncServiceError,
          'The sync service could not be started.'
        ),
      }),
    []
  );

  // Documents this app keeps to itself live in a repo with no network: they
  // structurally cannot reach the sync service.
  const privateRepoRef = useRef<Promise<Repo> | null>(null);
  const privateRepo = useMemo(
    () =>
      Effect.promise(() => {
        privateRepoRef.current ??= Effect.runPromise(createAutomergeRepo({}));

        return privateRepoRef.current;
      }),
    []
  );

  const documentSharing = useMemo((): DocumentSharing => {
    const adapter = (repo: Repo) =>
      createAutomergeDocumentSharingAdapter({
        // A shared document keeps working on what it holds, so a failure to
        // publish a change is logged rather than surfaced.
        repo,
        onError: console.error,
      });

    return {
      // Minting and releasing shares cannot report a sync-service failure
      // through the port; opening a share can, and does.
      shareDocument: (args) =>
        pipe(
          syncedRepo,
          Effect.orDie,
          Effect.flatMap((repo) => adapter(repo).shareDocument(args))
        ),
      openSharedDocument: (args) =>
        pipe(
          syncedRepo,
          Effect.mapError(
            () =>
              new SharedDocumentUnavailableError(
                'The sync service could not be started.'
              )
          ),
          Effect.flatMap((repo) => adapter(repo).openSharedDocument(args))
        ),
      leaveSharedDocument: (args) =>
        pipe(
          syncedRepo,
          Effect.orDie,
          Effect.flatMap((repo) => adapter(repo).leaveSharedDocument(args))
        ),
    };
  }, [syncedRepo]);

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
