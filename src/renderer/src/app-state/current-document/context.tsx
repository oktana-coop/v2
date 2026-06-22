import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useMatch,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';

import {
  isValidProjectId,
  type ProjectId,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  isEmpty,
  processDocumentChange,
  type RichTextDocument,
  type VersionedDocument,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  type ArtifactHistoryInfo,
  type Change,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type Commit,
  decodeUrlEncodedChangeId,
  decomposeGitBlobRef,
  isGitBlobRef,
  type ResolvedArtifactId,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  urlEncodeChangeIdForChange,
} from '../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../modules/personalization/browser';
import { useCurrentDocumentId } from '../../hooks/use-current-document-id';
import { usePulledUpstreamChanges } from '../../hooks/use-pulled-upstream-changes';
import {
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
} from '../';
import { createWorkerClient } from './history-worker/client';

export type CurrentDocumentContextType = {
  versionedDocumentId: ResolvedArtifactId | null;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  versionedDocument: VersionedDocument | null;
  onDocumentContentChange: (doc: RichTextDocument) => Promise<void>;
  loadingHistory: boolean;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  reloadDocumentHistory: () => Promise<void>;
  onRestoreCommit: (args: { message: string; commit: Commit }) => Promise<void>;
  onDiscardChanges: () => Promise<void>;
  commitToRestore: Commit | null;
  isRestoreCommitDialogOpen: boolean;
  isDiscardChangesDialogOpen: boolean;
  onOpenRestoreCommitDialog: (commit: Commit) => void;
  onCloseRestoreCommitDialog: () => void;
  onOpenDiscardChangesDialog: () => void;
  onCloseDiscardChangesDialog: () => void;
  selectedCommitIndex: number | null;
  onSelectChange: (commitId: ChangeId) => void;
};

export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    versionedDocumentId: null,
    versionedDocumentHandle: null,
    versionedDocument: null,
    onDocumentContentChange: async () => {},
    loadingHistory: false,
    versionedDocumentHistory: [],
    canCommit: false,
    reloadDocumentHistory: async () => {},
    onRestoreCommit: async () => {},
    onDiscardChanges: async () => {},
    isRestoreCommitDialogOpen: false,
    isDiscardChangesDialogOpen: false,
    commitToRestore: null,
    onOpenRestoreCommitDialog: () => {},
    onCloseRestoreCommitDialog: () => {},
    onOpenDiscardChangesDialog: () => {},
    onCloseDiscardChangesDialog: () => {},
    selectedCommitIndex: null,
    onSelectChange: () => {},
  }
);

export const CurrentDocumentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { config } = useContext(ElectronContext);
  const { filesystem, versionedDocumentStore } = useContext(
    InfrastructureAdaptersContext
  );
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);
  const { projectId: projectIdParam, changeId: changeIdParam } = useParams();
  const documentId = useCurrentDocumentId();
  const [searchParams] = useSearchParams();
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [lastCommit, setLastCommit] = useState<Commit | null>(null);
  const [canCommit, setCanCommit] = useState(false);
  const [isRestoreCommitDialogOpen, setIsRestoreCommitDialogOpen] =
    useState<boolean>(false);
  const [isDiscardChangesDialogOpen, setIsDiscardChangesDialogOpen] =
    useState<boolean>(false);
  const [commitToRestore, setCommitToRestore] = useState<Commit | null>(null);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(
    null
  );
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const navigate = useNavigate();
  const {
    selectedFileInfo,
    setSelectedFileInfo,
    directory,
    restoreDocumentChanges,
  } = useContext(MultiDocumentProjectContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const loadHistoryFromWorker = config.useHistoryWorker
    ? createWorkerClient()
    : undefined;
  const prevProjectId = useRef(projectIdParam);
  const prevDocumentId = useRef(documentId);
  const { pulledUpstreamChanges, resetPulledUpstreamChanges } =
    usePulledUpstreamChanges();
  const [documentNeedsReload, setDocumentNeedsReload] = useState(false);
  const documentRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId'
  );
  const documentChangeSubRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/changes/:changeId'
  );

  useEffect(() => {
    const projectOrDocumentHasChanged =
      prevProjectId.current !== projectIdParam ||
      prevDocumentId.current !== documentId;

    const returningToSelectedDocumentEditMode =
      prevDocumentId.current === documentId &&
      prevProjectId.current === projectIdParam &&
      !changeIdParam;

    const updateDocumentHandleAndSelectedFile = async ({
      versionedDocumentStore,
    }: {
      versionedDocumentStore: VersionedDocumentStore;
    }) => {
      if (!documentId) {
        setVersionedDocumentHandle(null);
        setVersionedDocument(null);
        resetPulledUpstreamChanges();
        setDocumentNeedsReload(false);
      } else {
        setVersionedDocumentHandle(null);
        setVersionedDocument(null);

        const { artifact: document, handle: documentHandle } =
          await Effect.runPromise(
            versionedDocumentStore.findDocumentById(documentId)
          );

        setVersionedDocumentHandle(documentHandle);
        setVersionedDocument(document);
        setLoadingHistory(true);
        setDocumentNeedsReload(false);

        // TODO: Clean this up. The ID in the Automerge case is not the file path, so we need to get it from somewhere else.
        // This is why we use the path query param, which must be set.
        // But this introduces potential race conditions (e.g. documentId and searchParams getting out-of-sync)
        let path: string | null;

        if (isGitBlobRef(documentId)) {
          const decomposedBlobRef = decomposeGitBlobRef(documentId);
          path = decomposedBlobRef.path;
        } else {
          const pathParam = searchParams.get('path');
          path = pathParam ? decodeURIComponent(pathParam) : null;
        }

        if (!path) {
          throw new Error(
            'Cannot propagate changes to file since path is not provided'
          );
        }

        setSelectedFileInfo({
          documentId,
          path,
        });
        resetPulledUpstreamChanges();

        prevProjectId.current = projectIdParam;
        prevDocumentId.current = documentId;
      }
    };

    if (
      versionedDocumentStore &&
      // This is a very important safeguard. We don't want to ask the document from a document store that belongs to another project
      // due to how Automerge repo syncing works at the moment. If this happens, the repo registers interest in the wrong document
      // and can potentially get it if we are not careful when switching projects. Change with caution.
      versionedDocumentStore.projectId === projectIdParam &&
      (projectOrDocumentHasChanged ||
        returningToSelectedDocumentEditMode ||
        pulledUpstreamChanges ||
        documentNeedsReload)
    ) {
      updateDocumentHandleAndSelectedFile({ versionedDocumentStore });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    projectIdParam,
    changeIdParam,
    versionedDocumentStore,
    pulledUpstreamChanges,
    documentNeedsReload,
  ]);

  const checkIfContentChangedFromLastCommit =
    (documentStore: VersionedDocumentStore) =>
    async (
      documentId: ResolvedArtifactId,
      latestChangeId: ChangeId,
      lastCommitId: ChangeId
    ) => {
      if (!changeIdsAreSame(latestChangeId, lastCommitId)) {
        const isContentSame = await Effect.runPromise(
          documentStore.isContentSameAtChanges({
            documentId,
            change1: latestChangeId,
            change2: lastCommitId,
          })
        );

        if (!isContentSame) {
          setCanCommit(true);
        } else {
          setCanCommit(false);
        }
      } else {
        setCanCommit(false);
      }
    };

  const checkIfCanCommit =
    (documentStore: VersionedDocumentStore) =>
    async ({
      docId,
      doc,
      latestChangeId,
      lastCommitId,
    }: {
      docId: ResolvedArtifactId;
      doc: VersionedDocument;
      latestChangeId: ChangeId;
      lastCommitId?: ChangeId;
    }) => {
      if (lastCommitId) {
        return checkIfContentChangedFromLastCommit(documentStore)(
          docId,
          latestChangeId,
          lastCommitId
        );
      } else {
        if (!isEmpty(doc)) {
          setCanCommit(true);
        } else {
          setCanCommit(false);
        }
      }
    };

  const loadHistory =
    (documentStore: VersionedDocumentStore) =>
    async ({
      docId,
      doc,
    }: {
      docId: ResolvedArtifactId;
      doc: VersionedDocument;
    }) => {
      let historyInfo: ArtifactHistoryInfo<RichTextDocument>;

      if (
        config.useHistoryWorker &&
        loadHistoryFromWorker &&
        documentStore.exportDocumentToBinary
      ) {
        const documentData = await Effect.runPromise(
          documentStore.exportDocumentToBinary(doc)
        );

        historyInfo = await loadHistoryFromWorker(documentData);
      } else {
        historyInfo = await Effect.runPromise(
          documentStore.getDocumentHistory(docId)
        );
      }

      const historyWithURLInfo = historyInfo.history.map((commit) => ({
        ...commit,
        urlEncodedChangeId: urlEncodeChangeIdForChange(commit),
      }));

      setVersionedDocumentHistory(historyWithURLInfo);
      setLastCommit(historyInfo.lastCommit);
      setLoadingHistory(false);
      await checkIfCanCommit(documentStore)({
        docId,
        doc: historyInfo.current,
        latestChangeId: historyInfo.latestChange.id,
        lastCommitId: historyInfo.lastCommit?.id,
      });

      return historyWithURLInfo;
    };

  useEffect(() => {
    if (versionedDocumentStore && documentId && versionedDocument) {
      loadHistory(versionedDocumentStore)({
        doc: versionedDocument,
        docId: documentId,
      });
    }
  }, [versionedDocument]);

  useEffect(() => {
    if (versionedDocumentHistory.length > 0 && changeIdParam) {
      const selectedCommitIndex = findSelectedCommitIndex({
        changeId: decodeUrlEncodedChangeId(changeIdParam),
        history: versionedDocumentHistory,
      });

      setSelectedCommitIndex(
        selectedCommitIndex === -1 ? null : selectedCommitIndex
      );
    }
  }, [versionedDocumentHistory, changeIdParam]);

  const reloadDocumentHistory = useCallback(async () => {
    if (!versionedDocumentStore || !versionedDocument || !documentId) return;
    await loadHistory(versionedDocumentStore)({
      doc: versionedDocument,
      docId: documentId,
    });
  }, [versionedDocumentStore, versionedDocument, documentId]);

  const handleRestoreCommit = useCallback(
    async ({ message, commit }: { message: string; commit: Commit }) => {
      if (!documentId || !versionedDocument || !versionedDocumentStore) {
        throw new Error(
          'Cannot restore commit. Either the document or its store is not initialized yet.'
        );
      }

      const restoreCommitId = await restoreDocumentChanges({
        documentId,
        commit,
        message,
      });

      const newHistory = await loadHistory(versionedDocumentStore)({
        doc: versionedDocument,
        docId: documentId,
      });

      setIsRestoreCommitDialogOpen(false);
      setCanCommit(false);
      handleSelectChange(restoreCommitId, newHistory);
    },
    [
      documentId,
      versionedDocument,
      versionedDocumentStore,
      restoreDocumentChanges,
    ]
  );

  const handleDiscardChanges = useCallback(async () => {
    if (!documentId || !versionedDocument || !versionedDocumentStore) {
      throw new Error(
        'Cannot discard changes. Either the document or its store is not initialized yet.'
      );
    }

    if (!directory || !selectedFileInfo?.path) {
      throw new Error('Cannot write to file when restoring commit in project');
    }

    await Effect.runPromise(
      pipe(
        filesystem.getAbsolutePath({
          path: selectedFileInfo.path,
          dirPath: directory.path,
        }),
        Effect.flatMap((absoluteFilePath) =>
          versionedDocumentStore.discardUncommittedChanges({
            documentId,
            writeToFileWithPath: absoluteFilePath,
          })
        )
      )
    );

    const newHistory = await loadHistory(versionedDocumentStore)({
      doc: versionedDocument,
      docId: documentId,
    });

    if (documentChangeSubRouteMatch) {
      const [lastCommit] = newHistory;
      handleSelectChange(lastCommit.id, newHistory);
    } else if (documentRouteMatch) {
      setDocumentNeedsReload(true);
    }

    setIsDiscardChangesDialogOpen(false);
    setCanCommit(false);
  }, [
    documentId,
    versionedDocument,
    versionedDocumentStore,
    documentChangeSubRouteMatch,
    documentRouteMatch,
  ]);

  const handleOpenRestoreCommitDialog = useCallback((commit: Commit) => {
    setIsRestoreCommitDialogOpen(true);
    setCommitToRestore(commit);
  }, []);

  const handleCloseRestoreCommitDialog = useCallback(() => {
    setIsRestoreCommitDialogOpen(false);
    setCommitToRestore(null);
  }, []);

  const handleOpenDiscardChangesDialog = useCallback(() => {
    setIsDiscardChangesDialogOpen(true);
  }, []);

  const handleCloseDiscardChangesDialog = useCallback(() => {
    setIsDiscardChangesDialogOpen(false);
  }, []);

  const findSelectedCommitIndex = ({
    changeId,
    history,
  }: {
    changeId: ChangeId;
    history: ChangeWithUrlInfo[];
  }) => history.findIndex((commit) => changeIdsAreSame(commit.id, changeId));

  const selectChange = ({
    projectId,
    documentId,
    history,
    changeId,
    showDiffInHistoryView,
  }: {
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    history: ChangeWithUrlInfo[];
    changeId: ChangeId;
    showDiffInHistoryView: boolean;
  }) => {
    const isInitialChange = (index: number, changes: Change[]) =>
      index === changes.length - 1;

    const selectedCommitIndex = findSelectedCommitIndex({ changeId, history });

    const isFirstCommit = isInitialChange(selectedCommitIndex, history);

    const diffCommit = isFirstCommit ? null : history[selectedCommitIndex + 1];

    let newUrl = `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(documentId)}/changes/${urlEncodeChangeId(changeId)}`;
    if (diffCommit) {
      const diffChangeURLEncodedId = urlEncodeChangeIdForChange(diffCommit);
      newUrl += `?diffWith=${diffChangeURLEncodedId}`;
    }

    if (showDiffInHistoryView && diffCommit) {
      newUrl += `&showDiff=true`;
    }

    navigate(newUrl);
  };

  const handleSelectChange = useCallback(
    (changeId: ChangeId, history?: ChangeWithUrlInfo[]) => {
      if (!projectIdParam || !isValidProjectId(projectIdParam) || !documentId) {
        throw new Error(
          'Cannot select a change since projectId or documentId are not set yet.'
        );
      }

      return selectChange({
        projectId: projectIdParam,
        documentId,
        history: history ?? versionedDocumentHistory,
        changeId,
        showDiffInHistoryView,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectIdParam,
      documentId,
      versionedDocumentHistory,
      showDiffInHistoryView,
    ]
  );

  const handleDocumentContentChange = useCallback(
    async (doc: RichTextDocument) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectIdParam
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!documentId) {
        throw new Error('Versioned document id not set yet.');
      }

      if (!versionedDocument) {
        throw new Error('Versioned document not set yet.');
      }

      if (!representationTransformAdapter) {
        throw new Error(
          'No representation transform adapter found when trying to convert to Automerge'
        );
      }

      if (!directory || !selectedFileInfo?.path) {
        throw new Error('Cannot update file in project');
      }

      await Effect.runPromise(
        pipe(
          filesystem.getAbsolutePath({
            path: selectedFileInfo.path,
            dirPath: directory.path,
          }),
          Effect.flatMap((absoluteFilePath) =>
            processDocumentChange({
              transformToText: representationTransformAdapter.transformToText,
              updateRichTextDocumentContent:
                versionedDocumentStore.updateRichTextDocumentContent,
              writeFile: filesystem.writeFile,
            })({
              documentId,
              updatedDocument: doc,
              writeToFileWithPath:
                versionedDocumentStore.managesFilesystemWorkdir
                  ? absoluteFilePath
                  : null,
            })
          )
        )
      );

      await loadHistory(versionedDocumentStore)({
        docId: documentId,
        doc: versionedDocument,
      });
    },
    [
      versionedDocumentStore,
      projectIdParam,
      documentId,
      representationTransformAdapter,
      filesystem,
      selectedFileInfo,
      directory,
      versionedDocument,
      lastCommit,
    ]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentId: documentId,
        versionedDocumentHandle,
        versionedDocument,
        onDocumentContentChange: handleDocumentContentChange,
        loadingHistory,
        versionedDocumentHistory,
        canCommit,
        reloadDocumentHistory,
        onRestoreCommit: handleRestoreCommit,
        onDiscardChanges: handleDiscardChanges,
        commitToRestore,
        isRestoreCommitDialogOpen,
        isDiscardChangesDialogOpen,
        onOpenRestoreCommitDialog: handleOpenRestoreCommitDialog,
        onCloseRestoreCommitDialog: handleCloseRestoreCommitDialog,
        onOpenDiscardChangesDialog: handleOpenDiscardChangesDialog,
        onCloseDiscardChangesDialog: handleCloseDiscardChangesDialog,
        selectedCommitIndex,
        onSelectChange: handleSelectChange,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
