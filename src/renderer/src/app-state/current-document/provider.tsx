import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';

import {
  type OpenedLiveDocument,
  openLiveDocument,
  type ProjectId,
  type ProjectStore,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  isEmpty,
  type VersionedDocument,
} from '../../../../modules/domain/rich-text';
import { createAdapter as createInMemoryLiveDocumentAdapter } from '../../../../modules/domain/rich-text/adapters/in-memory-live-document';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
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
import { subscribeToRef } from '../../../../utils/effect';
import { ProjectContext } from '../';
import { useCurrentChangeId } from '../current-project/current-artifact/use-current-change-id';
import { CurrentDocumentContext } from './context';
import { useCurrentDocumentId } from './use-current-document-id';
import { usePulledUpstreamChanges } from './use-pulled-upstream-changes';

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
  const { dispatchNotification } = useContext(NotificationsContext);
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const navigate = useNavigate();
  const changeId = useCurrentChangeId();
  const documentId = useCurrentDocumentId();
  const { pulledUpstreamChanges, resetPulledUpstreamChanges } =
    usePulledUpstreamChanges();

  // The open document's live content. It outlives editor mounts, so returning
  // from the history view never resurrects a stale snapshot.
  const [liveDocument, setLiveDocument] = useState<OpenedLiveDocument | null>(
    null
  );
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

  const documentChangeSubRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/changes/:changeId'
  );

  // Opens the current document as a live document. The previous one is kept
  // until the new one resolves, so a reload never blanks the state in between;
  // only the first load, with nothing yet to show, starts empty.
  useEffect(() => {
    if (
      !projectStore ||
      !projectId ||
      !documentId ||
      !representationTransformAdapter
    ) {
      setLiveDocument(null);
      return;
    }

    // Ignore an open the selection has already moved on from.
    let cancelled = false;
    let opened: OpenedLiveDocument | null = null;

    const close = (handle: OpenedLiveDocument) =>
      Effect.runPromise(handle.close).catch(console.error);

    setLoadingHistory(true);

    Effect.runPromise(
      openLiveDocument({
        createLiveDocumentAdapter: createInMemoryLiveDocumentAdapter,
        transformToText: representationTransformAdapter.transformToText,
        projectStore,
        onPersistError: (error) => {
          console.error(error);
          dispatchNotification(
            createErrorNotification({
              title: 'Save Document Error',
              message:
                'Your latest changes could not be saved. Please reach out to us for support.',
            })
          );
        },
      })({ projectId, documentId })
    )
      .then((handle) => {
        if (cancelled) {
          close(handle);
          return;
        }
        opened = handle;
        setLiveDocument(handle);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Open Document Error',
            message:
              'This document could not be opened. It may have been moved or deleted.',
          })
        );
        setLiveDocument(null);
        setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
      if (opened) close(opened);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, projectId, projectStore, representationTransformAdapter]);

  // A pull can change the open document underneath it; re-read to pick that up.
  useEffect(() => {
    if (pulledUpstreamChanges) {
      if (liveDocument) {
        Effect.runPromise(liveDocument.refresh).catch(console.error);
      }
      resetPulledUpstreamChanges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulledUpstreamChanges]);

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

  // History follows the live content: the subscribe-time replay performs the
  // initial load, and later edits reload it once the typing settles.
  useEffect(() => {
    if (!projectStore || !documentId || !liveDocument) return;

    const reloadHistory = debounce(() => {
      loadHistory(documentId);
    }, 500);

    const unsubscribe = subscribeToRef(liveDocument.content, reloadHistory);

    return () => {
      unsubscribe();
      reloadHistory.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDocument]);

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
    if (!projectStore || !liveDocument || !documentId) return;
    await loadHistory(documentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore, liveDocument, documentId]);

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
      if (!documentId || !liveDocument || !projectStore) {
        throw new Error(
          'Cannot restore commit. Either the document or the project store is not initialized yet.'
        );
      }

      // Land pending typing before the restore rewrites the working tree, then
      // re-read what the restore left there.
      await Effect.runPromise(liveDocument.flush);

      const restoreCommitId = await restoreDocumentChanges({
        documentId,
        commit,
        message,
      });

      await Effect.runPromise(liveDocument.refresh);

      const newHistory = await loadHistory(documentId);

      setIsRestoreCommitDialogOpen(false);
      setCanCommit(false);
      handleSelectChange(restoreCommitId, newHistory);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, liveDocument, projectStore, restoreDocumentChanges]
  );

  const handleDiscardChanges = useCallback(async () => {
    if (!documentId || !liveDocument || !projectStore || !projectId) {
      throw new Error(
        'Cannot discard changes. Either the document or the project store is not initialized yet.'
      );
    }

    // Drop pending typing first: a write landing mid-discard would resurrect
    // exactly what is being discarded.
    await Effect.runPromise(liveDocument.cancelPendingPersist);

    await Effect.runPromise(
      projectStore.discardUncommittedChanges({
        projectId,
        documentId,
      })
    );

    await Effect.runPromise(liveDocument.refresh);

    const newHistory = await loadHistory(documentId);

    if (documentChangeSubRouteMatch) {
      const [lastCommit] = newHistory;
      handleSelectChange(lastCommit.id, newHistory);
    }

    setIsDiscardChangesDialogOpen(false);
    setCanCommit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    liveDocument,
    projectStore,
    projectId,
    documentChangeSubRouteMatch,
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

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentId: documentId,
        liveDocument,
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
