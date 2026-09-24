import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';

import {
  getArtifactName,
  joinSharedDocument,
  leaveSharedDocument as leaveSharedDocumentCommand,
  openLiveDocument,
  type OpenSharedDocumentError,
  type ProjectId,
  type ProjectStore,
  SharedDocumentNotInProjectErrorTag,
  SharedDocumentOnAnotherBranchErrorTag,
  SharedDocumentUnavailableError,
  type ShareId,
  shareLiveDocument,
  type StoredLiveDocument,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  ConvergentDocumentChangeErrorTag,
  ConvergentDocumentUnavailableErrorTag,
  isEmpty,
  type VersionedDocument,
} from '../../../../modules/domain/rich-text';
import { createPrivateConvergentDocument } from '../../../../modules/domain/rich-text/adapters/automerge-convergent-document';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  type Notification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type Branch,
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
import { subscribeToRef, subscribeToStream } from '../../../../utils/effect';
import { ProjectContext } from '../';
import { useCurrentChangeId } from '../current-project/current-artifact/use-current-change-id';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { ShareRegistryContext } from '../share-registry';
import { CurrentDocumentContext } from './context';
import { type JoinSharedDocumentRefusal } from './types';
import { useCurrentDocumentId } from './use-current-document-id';
import { usePublishLocalPresence } from './use-presence';
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
  const {
    projectId,
    projectStore,
    currentBranch,
    currentArtifact,
    restoreDocumentChanges,
    subscribeToProjectDirChanges,
    switchToBranch,
    listBranches,
  } = useContext(ProjectContext);
  const { privateRepo, documentSharing } = useContext(
    InfrastructureAdaptersContext
  );
  const {
    registry: { findShareId, rememberShare, forgetShare },
  } = useContext(ShareRegistryContext);
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
  const [liveDocument, setLiveDocument] = useState<StoredLiveDocument | null>(
    null
  );
  const onLocalSelectionChange = usePublishLocalPresence(liveDocument);
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
  const [isShareDocumentDialogOpen, setIsShareDocumentDialogOpen] =
    useState<boolean>(false);
  const [isJoinSharedDocumentDialogOpen, setIsJoinSharedDocumentDialogOpen] =
    useState<boolean>(false);

  const documentChangeSubRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/changes/:changeId'
  );

  const shareKey = useMemo(
    () =>
      projectId && currentBranch && documentId
        ? { projectId, branch: currentBranch, documentId }
        : null,
    [projectId, currentBranch, documentId]
  );
  const shareId = shareKey ? findShareId(shareKey) : null;

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
    let opened: StoredLiveDocument | null = null;

    const close = (handle: StoredLiveDocument) =>
      Effect.runPromise(handle.close).catch((error) => {
        console.error(error);
        dispatchNotification(
          createErrorNotification({
            title: 'Save Document Error',
            message: 'Your latest changes could not be saved.',
          })
        );
      });

    setLoadingHistory(true);

    // Sharing must never stand between the user and their document: whatever
    // goes wrong, the document opens without sharing instead. A share that can
    // never work is also forgotten, so it stops being retried.
    const reportShareFailure = (error: OpenSharedDocumentError) => {
      console.error(error);

      // Being out of reach may pass; a share this app cannot read never will,
      // so that one is forgotten rather than retried on every open.
      const outOfReach = error instanceof SharedDocumentUnavailableError;

      if (!outOfReach && shareKey) forgetShare(shareKey);

      dispatchNotification(
        createErrorNotification({
          title: 'Shared Document Error',
          message: outOfReach
            ? 'The shared document could not be reached, so it was opened without sharing. Your changes are still saved.'
            : 'This shared document could not be used, so it was opened without sharing and is no longer shared here. Your changes are still saved.',
        })
      );
    };

    const createPrivateDocument = (initialText: string) =>
      createPrivateConvergentDocument({ initialText, privateRepo });

    Effect.runPromise(
      openLiveDocument({
        createPrivateDocument,
        openSharedDocument: documentSharing.openSharedDocument,
        onShareUnavailable: reportShareFailure,
        transformToText: representationTransformAdapter.transformToText,
        findDocumentById: projectStore.findDocumentById,
        updateRichTextDocumentContent:
          projectStore.updateRichTextDocumentContent,
        subscribeToProjectDirChanges,
      })({ projectId, documentId, shareId: shareId ?? undefined })
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
  }, [
    documentId,
    projectId,
    projectStore,
    representationTransformAdapter,
    subscribeToProjectDirChanges,
    currentBranch,
    currentArtifact,
  ]);

  // What the open document reports with nobody waiting on it. The editor keeps
  // working through all of it, so only what the user would otherwise never
  // learn — that their writing is not reaching the disk — is surfaced.
  useEffect(() => {
    if (!liveDocument) return;

    return subscribeToStream(liveDocument.errors, (error) => {
      console.error(error);

      const isConvergentDocumentError =
        error._tag === ConvergentDocumentChangeErrorTag ||
        error._tag === ConvergentDocumentUnavailableErrorTag;

      if (isConvergentDocumentError) return;

      dispatchNotification(
        createErrorNotification({
          title: 'Save Document Error',
          message: 'Your latest changes could not be saved.',
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDocument]);

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

      // Save pending typing before the restore rewrites the working tree. If
      // it cannot be saved, restoring would overwrite it, so nothing happens
      // and the changes stay where the user can still see them.
      try {
        await Effect.runPromise(liveDocument.flush);
      } catch (error) {
        console.error(error);
        dispatchNotification(
          createErrorNotification({
            title: 'Restore Version Error',
            message:
              'Your latest changes could not be saved, so this version was not restored.',
          })
        );
        return;
      }

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

    await Effect.runPromise(
      pipe(
        liveDocument.dropPendingLocalEdits,
        Effect.zipRight(
          projectStore.discardUncommittedChanges({ projectId, documentId })
        ),
        Effect.zipRight(liveDocument.refresh)
      )
    );

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

  const handleShareDocument = useCallback(async (): Promise<ShareId | null> => {
    if (!shareKey || !liveDocument || !currentArtifact) return null;

    try {
      return await Effect.runPromise(
        shareLiveDocument({
          liveDocument,
          shareDocument: documentSharing.shareDocument,
          rememberShare,
        })({
          projectId: shareKey.projectId,
          branch: shareKey.branch,
          documentId: shareKey.documentId,
          name: getArtifactName(currentArtifact.path),
        })
      );
    } catch (error) {
      console.error(error);
      dispatchNotification(
        createErrorNotification({
          title: 'Share Document Error',
          message: 'This document could not be shared.',
        })
      );
      return null;
    }
  }, [
    shareKey,
    liveDocument,
    currentArtifact,
    documentSharing,
    rememberShare,
    dispatchNotification,
  ]);

  const join = useCallback(
    async ({
      shareId: joinedShareId,
      branch,
    }: {
      shareId: ShareId;
      branch: Branch;
    }): Promise<JoinSharedDocumentRefusal | null> => {
      if (!projectId || !projectStore) return null;

      type JoinOutcome =
        | { joined: { documentId: ArtifactId; attached: boolean } }
        | { refusal: JoinSharedDocumentRefusal }
        | { notification: Notification };

      const outcome = await Effect.runPromise(
        pipe(
          joinSharedDocument({
            getSharedDocumentInfo: documentSharing.getSharedDocumentInfo,
            findDocumentById: projectStore.findDocumentById,
            rememberShare,
            openDocument: branch === currentBranch ? liveDocument : null,
          })({ shareId: joinedShareId, projectId, branch }),
          Effect.map((joined): JoinOutcome => ({ joined })),
          Effect.catchTag(SharedDocumentOnAnotherBranchErrorTag, (error) =>
            pipe(
              // Switching is offered only to a branch this project has.
              Effect.promise(() => listBranches().catch((): Branch[] => [])),
              Effect.map((branches): JoinOutcome => ({
                refusal: {
                  reason: 'other-branch',
                  branch: error.data.branch,
                  canSwitch: branches.includes(error.data.branch),
                },
              }))
            )
          ),
          Effect.catchTag(SharedDocumentNotInProjectErrorTag, () =>
            Effect.succeed<JoinOutcome>({
              refusal: { reason: 'not-in-project' },
            })
          ),
          Effect.catchAll((error) => {
            console.error(error);

            return Effect.succeed<JoinOutcome>({
              notification: createErrorNotification({
                title: 'Join Shared Document Error',
                message: 'This shared document link could not be joined.',
              }),
            });
          })
        )
      );

      if ('notification' in outcome) {
        dispatchNotification(outcome.notification);
        return null;
      }

      if ('refusal' in outcome) return outcome.refusal;

      setIsJoinSharedDocumentDialogOpen(false);

      // The shared document is captured (remembered) in local storage.
      // After navigation, the document will be opened as a shared one.
      if (!outcome.joined.attached) {
        navigate(
          `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(outcome.joined.documentId)}`
        );
      }

      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectId,
      currentBranch,
      projectStore,
      documentId,
      liveDocument,
      documentSharing,
      rememberShare,
      listBranches,
      dispatchNotification,
    ]
  );

  const handleJoinSharedDocument = useCallback(
    (joinedShareId: ShareId) =>
      currentBranch
        ? join({ shareId: joinedShareId, branch: currentBranch })
        : Promise.resolve(null),
    [currentBranch, join]
  );

  const handleSwitchToBranchAndJoin = useCallback(
    async ({
      shareId: joinedShareId,
      branch,
    }: {
      shareId: ShareId;
      branch: Branch;
    }): Promise<JoinSharedDocumentRefusal | null> => {
      const switchPrompt: JoinSharedDocumentRefusal = {
        reason: 'other-branch',
        branch,
        canSwitch: true,
      };

      try {
        const refusal = await switchToBranch(branch);

        if (refusal) return switchPrompt;
      } catch (error) {
        console.error(error);
        return switchPrompt;
      }

      return join({ shareId: joinedShareId, branch });
    },
    [switchToBranch, join]
  );

  const handleLeaveSharedDocument = useCallback(async () => {
    if (!shareKey || !shareId || !liveDocument) return;

    try {
      await Effect.runPromise(
        leaveSharedDocumentCommand({
          liveDocument,
          findShareId,
          forgetShare,
          leaveSharedDocument: documentSharing.leaveSharedDocument,
        })(shareKey)
      );
    } catch (error) {
      console.error(error);
      dispatchNotification(
        createErrorNotification({
          title: 'Stop Sharing Error',
          message:
            'Your latest changes could not be saved, so sharing was not stopped.',
        })
      );
    }
  }, [
    shareKey,
    shareId,
    liveDocument,
    findShareId,
    forgetShare,
    documentSharing,
    dispatchNotification,
  ]);

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentId: documentId,
        liveDocument,
        onLocalSelectionChange,
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
        shareId,
        onShareDocument: handleShareDocument,
        onJoinSharedDocument: handleJoinSharedDocument,
        onSwitchToBranchAndJoin: handleSwitchToBranchAndJoin,
        onLeaveSharedDocument: handleLeaveSharedDocument,
        isShareDocumentDialogOpen,
        isJoinSharedDocumentDialogOpen,
        onOpenShareDocumentDialog: () => setIsShareDocumentDialogOpen(true),
        onCloseShareDocumentDialog: () => setIsShareDocumentDialogOpen(false),
        onOpenJoinSharedDocumentDialog: () =>
          setIsJoinSharedDocumentDialogOpen(true),
        onCloseJoinSharedDocumentDialog: () =>
          setIsJoinSharedDocumentDialogOpen(false),
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
