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

import { projectTypes } from '../../../../modules/domain/project';
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
} from '../../../../modules/domain/rich-text';
import {
  type Change,
  type ChangeWithUrlInfo,
  type Commit,
  encodeURLHeads,
  encodeURLHeadsForChange,
  headsAreSame,
  type UrlHeads,
  type VersionedArtifactHandleChangePayload,
} from '../../../../modules/infrastructure/version-control';
import { isValidVersionControlId } from '../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../modules/personalization/functionality-config';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
} from '../';

export type CurrentDocumentContextType = {
  versionedDocumentHandle: VersionedDocumentHandle | null;
  setVersionedDocumentHandle: (handle: VersionedDocumentHandle | null) => void;
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
    versionedDocumentHandle: null,
    setVersionedDocumentHandle: () => {},
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
  const { filesystem, versionedDocumentStore } = useContext(
    InfrastructureAdaptersContext
  );
  const { projectType } = useContext(CurrentProjectContext);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { projectId, documentId } = useParams();
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
  const { setSelectedFileInfo, clearFileSelection } = useContext(
    MultiDocumentProjectContext
  );

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

    if (
      versionedDocumentStore &&
      versionedDocumentStore.projectId === projectId
    ) {
      updateDocumentHandleAndSelectedFile({ versionedDocumentStore });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, projectId, versionedDocumentStore]);

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
    if (versionedDocumentStore && versionedDocumentHandle) {
      loadHistory(versionedDocumentStore)(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle]);

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

      let newUrl = `/projects/${projectId}/documents/${documentId}/changes/${encodeURLHeads(heads)}`;
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

  const handleSetVersionedDocumentHandle = useCallback(
    (newHandle: VersionedDocumentHandle | null) => {
      if (!versionedDocumentStore) {
        throw new Error('Versioned document store not ready yet.');
      }

      return setVersionedDocumentHandle(newHandle);
    },
    [versionedDocumentStore]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentHandle,
        setVersionedDocumentHandle: handleSetVersionedDocumentHandle,
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
