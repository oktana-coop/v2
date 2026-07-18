import * as Effect from 'effect/Effect';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';

import {
  processDocumentChange,
  type ProjectId,
  type ProjectStore,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  isEmpty,
  type RichTextDocument,
  type VersionedDocument,
} from '../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  type ArtifactId,
  type Change,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type Commit,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  urlEncodeChangeIdForChange,
} from '../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../modules/personalization/browser';
import { useCurrentChangeId } from '../../hooks/use-current-change-id';
import { useCurrentDocumentId } from '../../hooks/use-current-document-id';
import { usePulledUpstreamChanges } from '../../hooks/use-pulled-upstream-changes';
import { ProjectContext } from '../';
import { CurrentDocumentContext } from './context';

const findSelectedCommitIndex = ({
  changeId,
  history,
}: {
  changeId: ChangeId;
  history: ChangeWithUrlInfo[];
}) => history.findIndex((commit) => changeIdsAreSame(commit.id, changeId));

export const CurrentDocumentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { projectId, projectStore, restoreDocumentChanges } =
    useContext(ProjectContext);
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const navigate = useNavigate();
  const changeId = useCurrentChangeId();
  const documentId = useCurrentDocumentId();
  const { pulledUpstreamChanges, resetPulledUpstreamChanges } =
    usePulledUpstreamChanges();

  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);
  const [documentNeedsReload, setDocumentNeedsReload] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [canCommit, setCanCommit] = useState(false);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(
    null
  );
  const [isRestoreCommitDialogOpen, setIsRestoreCommitDialogOpen] =
    useState<boolean>(false);
  const [isDiscardChangesDialogOpen, setIsDiscardChangesDialogOpen] =
    useState<boolean>(false);
  const [commitToRestore, setCommitToRestore] = useState<Commit | null>(null);

  const prevProjectId = useRef(projectId);
  const prevDocumentId = useRef(documentId);
  const documentRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId'
  );
  const documentChangeSubRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/changes/:changeId'
  );

  useEffect(() => {
    const projectOrDocumentHasChanged =
      prevProjectId.current !== projectId ||
      prevDocumentId.current !== documentId;

    const returningToSelectedDocumentEditMode =
      prevDocumentId.current === documentId &&
      prevProjectId.current === projectId &&
      !changeId;

    const loadDocument = async ({
      projectId,
      projectStore,
    }: {
      projectId: ProjectId;
      projectStore: ProjectStore;
    }) => {
      if (!documentId) {
        setVersionedDocument(null);
        resetPulledUpstreamChanges();
        setDocumentNeedsReload(false);
      } else {
        setVersionedDocument(null);

        const { artifact: document } = await Effect.runPromise(
          projectStore.findDocumentById({
            projectId,
            documentId,
          })
        );

        setVersionedDocument(document);
        setLoadingHistory(true);
        setDocumentNeedsReload(false);

        resetPulledUpstreamChanges();

        prevProjectId.current = projectId;
        prevDocumentId.current = documentId;
      }
    };

    if (
      projectStore &&
      projectId &&
      (projectOrDocumentHasChanged ||
        returningToSelectedDocumentEditMode ||
        pulledUpstreamChanges ||
        documentNeedsReload)
    ) {
      loadDocument({ projectId, projectStore });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    projectId,
    changeId,
    projectStore,
    pulledUpstreamChanges,
    documentNeedsReload,
  ]);

  const checkIfContentChangedFromLastCommit = async ({
    projectId,
    projectStore,
    documentId,
    latestChangeId,
    lastCommitId,
  }: {
    projectId: ProjectId;
    projectStore: ProjectStore;
    documentId: ArtifactId;
    latestChangeId: ChangeId;
    lastCommitId: ChangeId;
  }) => {
    if (!changeIdsAreSame(latestChangeId, lastCommitId)) {
      const isContentSame = await Effect.runPromise(
        projectStore.isContentSameAtChanges({
          projectId,
          documentId,
          change1: latestChangeId,
          change2: lastCommitId,
        })
      );

      setCanCommit(!isContentSame);
    } else {
      setCanCommit(false);
    }
  };

  const checkIfCanCommit = async ({
    projectId,
    projectStore,
    docId,
    doc,
    latestChangeId,
    lastCommitId,
  }: {
    projectId: ProjectId;
    projectStore: ProjectStore;
    docId: ArtifactId;
    doc: VersionedDocument;
    latestChangeId: ChangeId;
    lastCommitId?: ChangeId;
  }) => {
    if (lastCommitId) {
      return checkIfContentChangedFromLastCommit({
        projectId,
        projectStore,
        documentId: docId,
        latestChangeId,
        lastCommitId,
      });
    }

    setCanCommit(!isEmpty(doc));
  };

  const loadHistory = async (docId: ArtifactId) => {
    if (!projectStore || !projectId) return [];

    const historyInfo = await Effect.runPromise(
      projectStore.getDocumentHistory({
        projectId,
        documentId: docId,
      })
    );

    const historyWithURLInfo = historyInfo.history.map((commit) => ({
      ...commit,
      urlEncodedChangeId: urlEncodeChangeIdForChange(commit),
    }));

    setVersionedDocumentHistory(historyWithURLInfo);
    setLoadingHistory(false);
    await checkIfCanCommit({
      projectId,
      projectStore,
      docId,
      doc: historyInfo.current,
      latestChangeId: historyInfo.latestChange.id,
      lastCommitId: historyInfo.lastCommit?.id,
    });

    return historyWithURLInfo;
  };

  useEffect(() => {
    if (projectStore && documentId && versionedDocument) {
      loadHistory(documentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionedDocument]);

  useEffect(() => {
    if (versionedDocumentHistory.length > 0 && changeId) {
      const selectedCommitIndex = findSelectedCommitIndex({
        changeId,
        history: versionedDocumentHistory,
      });

      setSelectedCommitIndex(
        selectedCommitIndex === -1 ? null : selectedCommitIndex
      );
    }
  }, [versionedDocumentHistory, changeId]);

  const reloadDocumentHistory = useCallback(async () => {
    if (!projectStore || !versionedDocument || !documentId) return;
    await loadHistory(documentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore, versionedDocument, documentId]);

  const navigateToChange = ({
    projectId,
    documentId,
    history,
    changeId,
    showDiffInHistoryView,
  }: {
    projectId: ProjectId;
    documentId: ArtifactId;
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
      if (!projectId || !documentId) {
        throw new Error(
          'Cannot select a change since projectId or documentId are not set yet.'
        );
      }

      return navigateToChange({
        projectId,
        documentId,
        history: history ?? versionedDocumentHistory,
        changeId,
        showDiffInHistoryView,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, documentId, versionedDocumentHistory, showDiffInHistoryView]
  );

  const handleRestoreCommit = useCallback(
    async ({ message, commit }: { message: string; commit: Commit }) => {
      if (!documentId || !versionedDocument || !projectStore) {
        throw new Error(
          'Cannot restore commit. Either the document or the project store is not initialized yet.'
        );
      }

      const restoreCommitId = await restoreDocumentChanges({
        documentId,
        commit,
        message,
      });

      const newHistory = await loadHistory(documentId);

      setIsRestoreCommitDialogOpen(false);
      setCanCommit(false);
      handleSelectChange(restoreCommitId, newHistory);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, versionedDocument, projectStore, restoreDocumentChanges]
  );

  const handleDiscardChanges = useCallback(async () => {
    if (!documentId || !versionedDocument || !projectStore || !projectId) {
      throw new Error(
        'Cannot discard changes. Either the document or the project store is not initialized yet.'
      );
    }

    await Effect.runPromise(
      projectStore.discardUncommittedChanges({
        projectId,
        documentId,
      })
    );

    const newHistory = await loadHistory(documentId);

    if (documentChangeSubRouteMatch) {
      const [lastCommit] = newHistory;
      handleSelectChange(lastCommit.id, newHistory);
    } else if (documentRouteMatch) {
      setDocumentNeedsReload(true);
    }

    setIsDiscardChangesDialogOpen(false);
    setCanCommit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    versionedDocument,
    projectStore,
    projectId,
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

  const handleDocumentContentChange = useCallback(
    async (doc: RichTextDocument) => {
      if (!projectStore || !projectId) {
        throw new Error('Project store not ready yet or mismatched project.');
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

      await Effect.runPromise(
        processDocumentChange({
          transformToText: representationTransformAdapter.transformToText,
          updateRichTextDocumentContent:
            projectStore.updateRichTextDocumentContent,
        })({
          projectId,
          documentId,
          updatedDocument: doc,
        })
      );

      await loadHistory(documentId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectStore,
      projectId,
      documentId,
      representationTransformAdapter,
      versionedDocument,
    ]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentId: documentId,
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
