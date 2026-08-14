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
  type ShareUrl,
} from '../../../../modules/domain/project';
import { createAdapter as createAutomergeProjectSyncAdapter } from '../../../../modules/domain/project/adapters/automerge-project-sync';
import {
  createElectronAssetProtocolAdapter,
  createElectronRendererProjectStoreManagerAdapter,
} from '../../../../modules/domain/project/browser';
import { SharedDocumentUnavailableError } from '../../../../modules/domain/rich-text';
import {
  type AutomergeLiveDocument,
  type AutomergeLiveDocumentAdapterDeps,
  createAdapter as createAutomergeLiveDocumentAdapter,
  type OpenSharedDocumentError,
} from '../../../../modules/domain/rich-text/adapters/automerge-live-document';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  type DirectoryWatcher,
  type Filesystem,
} from '../../../../modules/infrastructure/filesystem';
import { createAdapter as createElectronRendererDirectoryWatcherAdapter } from '../../../../modules/infrastructure/filesystem/adapters/directory-watcher/electron-renderer-api';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../../../../modules/infrastructure/filesystem/adapters/filesystem/electron-renderer-api';
import { createAutomergeRepo } from '../../../../modules/infrastructure/sync';
import { mapErrorTo } from '../../../../utils/errors';
import { LoadingText } from '../../components/progress/LoadingText';

export type OpenPrivateLiveDocumentArgs = Omit<
  AutomergeLiveDocumentAdapterDeps,
  'repo' | 'shareUrl'
>;

export type OpenSharedLiveDocumentArgs = OpenPrivateLiveDocumentArgs & {
  shareUrl: ShareUrl;
};

export type InfrastructureAdaptersContextType = {
  filesystem: Filesystem;
  directoryWatcher: DirectoryWatcher;
  projectStoreManager: ProjectStoreManager;
  assetUrlProtocol: AssetUrlProtocol;
  projectStore: ProjectStore | null;
  setProjectStore: (store: ProjectStore | null) => void;
  projectSync: ProjectSync;
  openPrivateLiveDocument: (
    args: OpenPrivateLiveDocumentArgs
  ) => Effect.Effect<AutomergeLiveDocument>;
  openSharedLiveDocument: (
    args: OpenSharedLiveDocumentArgs
  ) => Effect.Effect<AutomergeLiveDocument, OpenSharedDocumentError>;
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
    openPrivateLiveDocument: null,
    // @ts-expect-error will get overriden below
    openSharedLiveDocument: null,
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
  const repoRef = useRef<Promise<Repo> | null>(null);
  const getRepo = useCallback(() => {
    // The override lets tests and offline development point at a local sync
    // server without rebuilding.
    const syncServiceUrl =
      localStorage.getItem('syncServiceUrl') ?? buildConfig.syncServiceUrl;

    repoRef.current ??= Effect.runPromise(
      createAutomergeRepo({ syncServiceUrl })
    );

    return repoRef.current;
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
          Effect.promise(getRepo),
          Effect.flatMap((repo) =>
            createAutomergeProjectSyncAdapter({ repo }).shareDocument(args)
          )
        ),
      leaveSharedDocument: (args) =>
        pipe(
          Effect.promise(getRepo),
          Effect.flatMap((repo) =>
            createAutomergeProjectSyncAdapter({ repo }).leaveSharedDocument(
              args
            )
          )
        ),
    }),
    [getRepo]
  );

  const openPrivateLiveDocument = useCallback(
    (args: OpenPrivateLiveDocumentArgs) =>
      pipe(
        // Not being able to build a local repo means Automerge itself cannot
        // initialize — nothing document-related works, so this is a defect.
        Effect.promise(getHostRepo),
        Effect.flatMap((repo) =>
          createAutomergeLiveDocumentAdapter({ repo, ...args })
        )
      ),
    [getHostRepo]
  );

  const openSharedLiveDocument = useCallback(
    (args: OpenSharedLiveDocumentArgs) =>
      pipe(
        Effect.tryPromise({
          try: getRepo,
          catch: mapErrorTo(
            SharedDocumentUnavailableError,
            'The sync service could not be started.'
          ),
        }),
        Effect.flatMap((repo) =>
          createAutomergeLiveDocumentAdapter({ repo, ...args })
        )
      ),
    [getRepo]
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
        openPrivateLiveDocument,
        openSharedLiveDocument,
      }}
    >
      {children}
    </InfrastructureAdaptersContext.Provider>
  );
};
