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

import { ElectronContext } from '../../../modules/cross-platform';
import {
  convertToStorageFormat,
  type GetDocumentHandleAtCommitArgs,
  isEmpty,
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../modules/rich-text';
import { removeExtension, removePath } from '../../filesystem';
import { FilesystemContext } from '../../filesystem/react';
import { FunctionalityConfigContext } from '../../personalization/functionality-config';
import {
  type Change,
  type ChangeWithUrlInfo,
  type Commit,
  encodeURLHeads,
  encodeURLHeadsForChange,
  getArtifactHandleHistory,
  getArtifactHeads,
  headsAreSame,
  isArtifactContentSameAtHeads as isContentSameAtHeads,
  isValidVersionControlId,
  type UrlHeads,
  type VersionControlId,
  type VersionedArtifactHandleChangePayload,
} from '../../version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type CurrentDocumentContextType = {
  selectedFileInfo: SelectedFileInfo | null;
  selectedFileName: string | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  onCommit: (message: string) => void;
  isCommitDialogOpen: boolean;
  onOpenCommitDialog: () => void;
  onCloseCommitDialog: () => void;
  selectedCommitIndex: number | null;
  onSelectCommit: (heads: UrlHeads) => void;
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Promise<VersionedDocumentHandle>;
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
    onCommit: () => {},
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
  const { versionedDocumentStore } = useContext(InfrastructureAdaptersContext);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const { writeFile } = useContext(FilesystemContext);
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

  useEffect(() => {
    const updateFileSelection = async () => {
      if (!isValidVersionControlId(documentId)) {
        clearFileSelection();
        setVersionedDocumentHandle(null);
      } else {
        const pathParam = searchParams.get('path');
        const path = pathParam ? decodeURIComponent(pathParam) : null;

        const documentHandle = await Effect.runPromise(
          versionedDocumentStore.findDocumentById(documentId)
        );
        if (!documentHandle) {
          throw new Error(
            'No document handle found in repository for the selected document'
          );
        }

        const propagateChangesToFile = (
          changePayload: VersionedArtifactHandleChangePayload<RichTextDocument>
        ) => {
          if (path) {
            writeFile(path, convertToStorageFormat(changePayload.doc));
          }
        };

        documentHandle.on('change', propagateChangesToFile);

        setVersionedDocumentHandle(documentHandle);
        setSelectedFileInfo({
          documentId,
          path,
        });

        return () => {
          documentHandle.off('change', propagateChangesToFile);
        };
      }
    };

    updateFileSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    if (selectedFileInfo && selectedFileInfo.path) {
      const fullFileName = removePath(selectedFileInfo.path);
      const cleanFileName = removeExtension(fullFileName);
      setSelectedFileName(cleanFileName);
    }
  }, [selectedFileInfo]);

  const checkIfContentChangedFromLastCommit = (
    currentDoc: VersionedDocument,
    latestChangeHeads: UrlHeads,
    lastCommitHeads: UrlHeads
  ) => {
    if (
      !headsAreSame(latestChangeHeads, lastCommitHeads) &&
      !isContentSameAtHeads(currentDoc, latestChangeHeads, lastCommitHeads)
    ) {
      setCanCommit(true);
    } else {
      setCanCommit(false);
    }
  };

  const checkIfCanCommit = (
    currentDoc: VersionedDocument,
    latestChangeHeads: UrlHeads,
    lastCommitHeads?: UrlHeads
  ) => {
    if (lastCommitHeads) {
      checkIfContentChangedFromLastCommit(
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

  const loadHistory = async (docHandle: VersionedDocumentHandle) => {
    const { history, current, lastCommit, latestChange } =
      await getArtifactHandleHistory(docHandle);

    const historyWithURLInfo = history.map((commit) => ({
      ...commit,
      urlEncodedHeads: encodeURLHeadsForChange(commit),
    }));

    setVersionedDocumentHistory(historyWithURLInfo);
    setLastCommit(lastCommit);
    checkIfCanCommit(current, latestChange.heads, lastCommit?.heads);
  };

  useEffect(() => {
    const updateDocTitle = async (docHandle: VersionedDocumentHandle) => {
      const doc = await docHandle.doc();
      document.title = `v2 | "${doc.title}"`;
    };

    if (versionedDocumentHandle) {
      updateDocTitle(versionedDocumentHandle);
      loadHistory(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle]);

  useEffect(() => {
    if (versionedDocumentHandle) {
      const handler = (
        args: VersionedArtifactHandleChangePayload<RichTextDocument>
      ) => {
        loadHistory(versionedDocumentHandle);
        checkIfCanCommit(
          args.doc,
          getArtifactHeads(args.doc),
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
  }, [lastCommit, versionedDocumentHandle]);

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

  const commitChanges = useCallback(
    (message: string) => {
      if (!versionedDocumentHandle) return;

      versionedDocumentHandle.change(
        (doc) => {
          // this is effectively a no-op, but it triggers a change event
          // (not) changing the title of the document, as interfering with the
          // content outside the Prosemirror API will cause loss of formatting
          // eslint-disable-next-line no-self-assign
          doc.title = doc.title;
        },
        {
          message,
          time: new Date().getTime(),
        }
      );

      setIsCommitDialogOpen(false);
      setCanCommit(false);
    },
    [versionedDocumentHandle]
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

  const handleGetDocumentHandleAtCommit = async (
    args: GetDocumentHandleAtCommitArgs
  ) =>
    Effect.runPromise(versionedDocumentStore.getDocumentHandleAtCommit(args));

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
        onCommit: commitChanges,
        isCommitDialogOpen,
        onOpenCommitDialog: handleOpenCommitDialog,
        onCloseCommitDialog: handleCloseCommitDialog,
        selectedCommitIndex,
        onSelectCommit: handleSelectCommit,
        getDocumentHandleAtCommit: handleGetDocumentHandleAtCommit,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
