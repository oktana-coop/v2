import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { projectTypes } from '../../../modules/domain/project';
import {
  type GetDocumentHandleAtCommitArgs,
  type IsContentSameAtHeadsArgs,
  isEmpty,
  registerLiveUpdates,
  type RichTextDocument,
  unregisterLiveUpdates,
  type VersionedDocument,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../modules/domain/rich-text';
import { ElectronContext } from '../../../modules/infrastructure/cross-platform';
import {
  removeExtension,
  removePath,
} from '../../../modules/infrastructure/filesystem';
import {
  type Change,
  type ChangeWithUrlInfo,
  type Commit,
  encodeURLHeads,
  encodeURLHeadsForChange,
  headsAreSame,
  isValidVersionControlId,
  type UrlHeads,
  type VersionControlId,
  type VersionedArtifactHandleChangePayload,
} from '../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../modules/personalization/functionality-config';
import { CurrentProjectContext } from '../current-project/context';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

export type CurrentDocumentContextType = {
  // TODO: Selected file info (per-document) applies only to multi-document projects, we need to refactor this.
  selectedFileInfo: SelectedFileInfo | null;
  selectedFileName: string | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  onCommit: (message: string) => Promise<void>;
  isCommitDialogOpen: boolean;
  onOpenCommitDialog: () => void;
  onCloseCommitDialog: () => void;
  selectedCommitIndex: number | null;
  onSelectCommit: (heads: UrlHeads) => void;
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Promise<VersionedDocumentHandle>;
  isContentSameAtHeads: (args: IsContentSameAtHeadsArgs) => boolean;
};

export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    selectedFileInfo: null,
    selectedFileName: null,
    setSelectedFileInfo: async () => {},
    clearFileSelection: async () => {},
    versionedDocumentHandle: null,
    versionedDocumentHistory: [],
    canCommit: false,
    onCommit: async () => {},
    isCommitDialogOpen: false,
    onOpenCommitDialog: () => {},
    onCloseCommitDialog: () => {},
    selectedCommitIndex: null,
    onSelectCommit: () => {},
    // @ts-expect-error will get overriden below
    getDocumentHandleAtCommit: async () => null,
  }
);

export const CurrentDocumentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const { filesystem, versionedDocumentStore } = useContext(
    InfrastructureAdaptersContext
  );
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [lastCommit, setLastCommit] = useState<Commit | null>(null);
  const [canCommit, setCanCommit] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState<boolean>(false);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(
    null
  );
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const navigate = useNavigate();
  const { projectType } = useContext(CurrentProjectContext);

  useEffect(() => {
    const updateDocumentHandleAndSelectedFile = async ({
      versionedDocumentStore,
    }: {
      versionedDocumentStore: VersionedDocumentStore;
    }) => {
      if (!isValidVersionControlId(documentId)) {
        clearFileSelection();
        setVersionedDocumentHandle(null);
      } else {
        if (!versionedDocumentStore) {
          throw new Error('Versioned document store not ready yet.');
        }

        const documentHandle = await Effect.runPromise(
          versionedDocumentStore.findDocumentById(documentId)
        );

        setVersionedDocumentHandle(documentHandle);

        if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
          const pathParam = searchParams.get('path');
          const path = pathParam ? decodeURIComponent(pathParam) : null;

          if (!path) {
            throw new Error(
              'Cannot propagate changes to file since path is not provided'
            );
          }

          setSelectedFileInfo({
            documentId,
            path,
          });

          const { registeredListener } = await registerLiveUpdates({
            findDocumentById: versionedDocumentStore.findDocumentById,
            writeFile: filesystem.writeFile,
          })({
            documentHandle,
            filePath: path,
          });

          return () => {
            unregisterLiveUpdates({ documentHandle, registeredListener });
          };
        }
      }
    };

    if (versionedDocumentStore) {
      updateDocumentHandleAndSelectedFile({ versionedDocumentStore });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, versionedDocumentStore]);

  useEffect(() => {
    if (selectedFileInfo && selectedFileInfo.path) {
      const fullFileName = removePath(selectedFileInfo.path);
      const cleanFileName = removeExtension(fullFileName);
      setSelectedFileName(cleanFileName);
    }
  }, [selectedFileInfo]);

  const checkIfContentChangedFromLastCommit =
    (documentStore: VersionedDocumentStore) =>
    (
      currentDoc: VersionedDocument,
      latestChangeHeads: UrlHeads,
      lastCommitHeads: UrlHeads
    ) => {
      if (
        !headsAreSame(latestChangeHeads, lastCommitHeads) &&
        !documentStore.isContentSameAtHeads({
          document: currentDoc,
          heads1: latestChangeHeads,
          heads2: lastCommitHeads,
        })
      ) {
        setCanCommit(true);
      } else {
        setCanCommit(false);
      }
    };

  const checkIfCanCommit =
    (documentStore: VersionedDocumentStore) =>
    (
      currentDoc: VersionedDocument,
      latestChangeHeads: UrlHeads,
      lastCommitHeads?: UrlHeads
    ) => {
      if (lastCommitHeads) {
        checkIfContentChangedFromLastCommit(documentStore)(
          currentDoc,
          latestChangeHeads,
          lastCommitHeads
        );
      } else {
        if (!isEmpty(currentDoc)) {
          setCanCommit(true);
        } else {
          setCanCommit(false);
        }
      }
    };

  const loadHistory =
    (documentStore: VersionedDocumentStore) =>
    async (docHandle: VersionedDocumentHandle) => {
      const { history, current, lastCommit, latestChange } =
        await Effect.runPromise(
          documentStore.getDocumentHandleHistory(docHandle)
        );

      const historyWithURLInfo = history.map((commit) => ({
        ...commit,
        urlEncodedHeads: encodeURLHeadsForChange(commit),
      }));

      setVersionedDocumentHistory(historyWithURLInfo);
      setLastCommit(lastCommit);
      checkIfCanCommit(documentStore)(
        current,
        latestChange.heads,
        lastCommit?.heads
      );
    };

  useEffect(() => {
    const updateBrowserTabTitle = async (name: string) => {
      window.document.title = `v2 | "${name}"`;
    };

    if (versionedDocumentStore && versionedDocumentHandle) {
      if (selectedFileName) {
        updateBrowserTabTitle(selectedFileName);
      }

      loadHistory(versionedDocumentStore)(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle, versionedDocumentStore, selectedFileName]);

  useEffect(() => {
    if (versionedDocumentStore && versionedDocumentHandle) {
      const handler = (
        args: VersionedArtifactHandleChangePayload<RichTextDocument>
      ) => {
        loadHistory(versionedDocumentStore)(versionedDocumentHandle);
        checkIfCanCommit(versionedDocumentStore)(
          args.doc,
          Effect.runSync(versionedDocumentStore.getDocumentHeads(args.doc)),
          lastCommit?.heads
        );
      };

      const debouncedHandler = debounce(handler, 300);
      versionedDocumentHandle.on('change', debouncedHandler);

      return () => {
        versionedDocumentHandle.off('change', debouncedHandler);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCommit, versionedDocumentHandle, versionedDocumentStore]);

  const clearFileSelection = async () => {
    setSelectedFileInfo(null);
  };

  const handleSetSelectedFileInfo = async ({
    documentId,
    path,
  }: SelectedFileInfo) => {
    if (isElectron) {
      window.electronAPI.sendCurrentDocumentId(documentId);
    }

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  const handleCommit = useCallback(
    async (message: string) => {
      if (!versionedDocumentHandle || !versionedDocumentStore) return;
      await Effect.runPromise(
        versionedDocumentStore.commitChanges({
          documentHandle: versionedDocumentHandle,
          message,
        })
      );
      setIsCommitDialogOpen(false);
      setCanCommit(false);
    },
    [versionedDocumentHandle, versionedDocumentStore]
  );

  const handleOpenCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCloseCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(false);
  }, []);

  const handleSelectCommit = useCallback(
    (heads: UrlHeads) => {
      const isInitialChange = (index: number, changes: Change[]) =>
        index === changes.length - 1;

      const selectedCommitIndex = versionedDocumentHistory.findIndex((commit) =>
        headsAreSame(commit.heads, heads)
      );

      const isFirstCommit = isInitialChange(
        selectedCommitIndex,
        versionedDocumentHistory
      );

      const diffCommit = isFirstCommit
        ? null
        : versionedDocumentHistory[selectedCommitIndex + 1];

      let newUrl = `/documents/${documentId}/changes/${encodeURLHeads(heads)}`;
      if (diffCommit) {
        const diffCommitURLEncodedHeads = encodeURLHeadsForChange(diffCommit);
        newUrl += `?diffWith=${diffCommitURLEncodedHeads}`;
      }

      if (showDiffInHistoryView && diffCommit) {
        newUrl += `&showDiff=true`;
      }

      setSelectedCommitIndex(selectedCommitIndex);
      navigate(newUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, versionedDocumentHistory, showDiffInHistoryView]
  );

  const handleGetDocumentHandleAtCommit = useCallback(
    async (args: GetDocumentHandleAtCommitArgs) => {
      if (!versionedDocumentStore) {
        throw new Error('Versioned document store not ready yet.');
      }

      return Effect.runPromise(
        versionedDocumentStore.getDocumentHandleAtCommit(args)
      );
    },
    [versionedDocumentStore]
  );

  const handleIsContentSameAtHeads = useCallback(
    (args: IsContentSameAtHeadsArgs) => {
      if (!versionedDocumentStore) {
        throw new Error('Versioned document store not ready yet.');
      }

      return versionedDocumentStore.isContentSameAtHeads(args);
    },
    [versionedDocumentStore]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        selectedFileInfo,
        selectedFileName,
        versionedDocumentHandle,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
        versionedDocumentHistory,
        canCommit,
        onCommit: handleCommit,
        isCommitDialogOpen,
        onOpenCommitDialog: handleOpenCommitDialog,
        onCloseCommitDialog: handleCloseCommitDialog,
        selectedCommitIndex,
        onSelectCommit: handleSelectCommit,
        getDocumentHandleAtCommit: handleGetDocumentHandleAtCommit,
        isContentSameAtHeads: handleIsContentSameAtHeads,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
