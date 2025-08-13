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
  type ArtifactHistoryInfo,
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
import {
  isSuccessResult,
  type LoadHistoryMessage,
  type LoadHistoryResult,
} from './history-worker/types';

// Using a web worker because loading history is an expensive operation
const worker = new Worker(
  new URL('./history-worker/index.ts', import.meta.url),
  { type: 'module' }
);

const createLoadHistoryFromWorker = () => {
  // Assign a unique ID to each message sent to the worker and include it in the worker's response.
  // This way, the worker's response is matched to the correct promise.
  let messageId = 0; // Unique ID for each message

  return (
    documentData: Uint8Array
  ): Promise<ArtifactHistoryInfo<RichTextDocument>> =>
    new Promise((resolve, reject) => {
      const currentMessageId = messageId++;

      const handleMessage = (event: MessageEvent) => {
        const result = event.data as LoadHistoryResult;

        if (result.messageId === currentMessageId) {
          worker.removeEventListener('message', handleMessage); // Clean up listener
          if (isSuccessResult(result)) {
            resolve(result.historyInfo);
          } else {
            reject(new Error(result.errorMessage));
          }
        }
      };

      // Listen for messages from the worker
      worker.addEventListener('message', handleMessage);

      const message: LoadHistoryMessage = {
        messageId: currentMessageId,
        documentData,
      };

      // Post a message to the worker to start the WASI CLI execution
      worker.postMessage(message);
    });
};

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
  const loadHistoryFromWorker = createLoadHistoryFromWorker();

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
      // This is a very important safeguard. We don't want to ask the document from a document store that belongs to another project
      // due to how Automerge repo syncing works at the moment. If this happens, the repo registers interest in the wrong document
      // and can potentially get it if we are not careful when switching projects. Change with caution.
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
      // Unfortunately we can't get it from the history results since some non-serializeable
      // properties of the Automerge document are lost in the messages with the worker.
      const current = await Effect.runPromise(
        documentStore.getDocumentFromHandle(docHandle)
      );

      const documentData = await Effect.runPromise(
        documentStore.exportDocumentToBinary(current)
      );

      const { history, lastCommit, latestChange } =
        await loadHistoryFromWorker(documentData);

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
