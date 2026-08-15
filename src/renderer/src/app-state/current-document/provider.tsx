import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';

import {
  joinSharedDocument,
  leaveSharedDocument as leaveSharedDocumentCommand,
  type LiveDocumentDiskDeps,
  openLiveDocument,
  type OpenLiveDocumentResult,
  type ProjectId,
  type ProjectStore,
  shareLiveDocument,
  type ShareUrl,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  isEmpty,
  SharedDocumentUnavailableError,
  type VersionedDocument,
} from '../../../../modules/domain/rich-text';
import {
  acquireSharedDocument,
  type AutomergeLiveDocument,
  createAdapter,
  type OpenSharedDocumentError,
  startDocument,
} from '../../../../modules/domain/rich-text/adapters/automerge-live-document';
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
import { mapErrorTo } from '../../../../utils/errors';
import { ProjectContext } from '../';
import { useCurrentChangeId } from '../current-project/current-artifact/use-current-change-id';
import { DocumentSharingInfoContext } from '../document-sharing-info';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
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
  const {
    projectId,
    projectStore,
    currentBranch,
    restoreDocumentChanges,
    subscribeToProjectDirChanges,
  } = useContext(ProjectContext);
  const { getSyncedRepo, getHostRepo, projectSync } = useContext(
    InfrastructureAdaptersContext
  );
  const { shareUrlFor, rememberShare, forgetShare } = useContext(
    DocumentSharingInfoContext
  );
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
  const [liveDocument, setLiveDocument] =
    useState<OpenLiveDocumentResult | null>(null);
  // The concrete adapter behind `liveDocument`: share/join/leave continue it
  // on another document in place, which the port deliberately cannot express.
  const concreteLiveDocument = useRef<AutomergeLiveDocument | null>(null);
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

  const shareKey =
    projectId && currentBranch && documentId
      ? { projectId, branch: currentBranch, documentId }
      : null;
  const shareUrl = shareKey ? shareUrlFor(shareKey) : null;

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
    let opened: OpenLiveDocumentResult | null = null;

    const close = (handle: OpenLiveDocumentResult) =>
      Effect.runPromise(handle.close).catch(console.error);

    setLoadingHistory(true);

    // Sharing must never stand between the user and their document: whatever
    // goes wrong, the document opens on its own instead. A share that can
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
            ? 'The shared document could not be reached, so it was opened on its own. Your changes are still saved.'
            : 'This shared document could not be used, so it was opened on its own and is no longer shared here. Your changes are still saved.',
        })
      );
    };

    const createLiveDocumentAdapter = (disk: LiveDocumentDiskDeps) => {
      const args = {
        ...disk,
        transformToText: representationTransformAdapter.transformToText,
        // The document keeps working on what it holds, so a failure to
        // publish, persist, or read a change is logged rather than surfaced.
        onError: console.error,
      };

      // Not being able to build a local repo means Automerge itself cannot
      // initialize — nothing document-related works, so that is a defect.
      const openPrivately = pipe(
        Effect.promise(getHostRepo),
        Effect.flatMap((repo) => createAdapter({ repo, ...args }))
      );

      return pipe(
        shareUrl
          ? pipe(
              Effect.tryPromise({
                try: getSyncedRepo,
                catch: mapErrorTo(
                  SharedDocumentUnavailableError,
                  'The sync service could not be started.'
                ),
              }),
              Effect.flatMap((repo) =>
                createAdapter({ repo, ...args, shareUrl })
              ),
              Effect.catchAll((error) => {
                reportShareFailure(error);
                return openPrivately;
              })
            )
          : openPrivately,
        // The share and join transitions need the concrete adapter.
        Effect.tap((live) =>
          Effect.sync(() => {
            concreteLiveDocument.current = live;
          })
        )
      );
    };

    Effect.runPromise(
      openLiveDocument({
        createLiveDocumentAdapter,
        transformToText: representationTransformAdapter.transformToText,
        findDocumentById: projectStore.findDocumentById,
        updateRichTextDocumentContent:
          projectStore.updateRichTextDocumentContent,
        subscribeToProjectDirChanges,
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
        // Picking up an outside edit is best-effort: the editor keeps working
        // on what it holds, so this is logged rather than surfaced.
        onRefreshOnDiskChangeError: console.error,
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
      concreteLiveDocument.current = null;
      if (opened) close(opened);
    };
    // The share registry is read at open time only: sharing, joining, and
    // leaving switch the open document in place rather than re-opening it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    projectId,
    projectStore,
    representationTransformAdapter,
    subscribeToProjectDirChanges,
    currentBranch,
  ]);

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

  // Shares what the store holds, so what the editor has is written first.
  // Continues the open document on the shared document at the given address.
  const attachSharedDocument = useCallback(
    (url: ShareUrl) =>
      pipe(
        Effect.tryPromise({
          try: getSyncedRepo,
          catch: mapErrorTo(
            SharedDocumentUnavailableError,
            'The sync service could not be started.'
          ),
        }),
        Effect.flatMap((repo) =>
          acquireSharedDocument({ repo, shareUrl: url })
        ),
        Effect.flatMap(
          (handle) =>
            concreteLiveDocument.current?.switchTo(handle) ?? Effect.void
        )
      ),
    [getSyncedRepo]
  );

  const handleShareDocument = useCallback(async () => {
    if (!shareKey || !liveDocument) return;

    try {
      await Effect.runPromise(
        shareLiveDocument({
          readLiveContent: pipe(
            SubscriptionRef.get(liveDocument.content),
            Effect.map((current) => current.doc.content)
          ),
          shareDocument: projectSync.shareDocument,
          attachSharedDocument,
          rememberShare: (url) => rememberShare({ ...shareKey, shareUrl: url }),
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
    }
  }, [
    shareKey,
    projectStore,
    liveDocument,
    projectSync,
    rememberShare,
    dispatchNotification,
  ]);

  // The link says nothing about which document it belongs to, so it joins the
  // one that is open; attaching is what checks the link is usable.
  const handleJoinSharedDocument = useCallback(
    async (joinedShareUrl: ShareUrl) => {
      if (!shareKey || !liveDocument) return;

      try {
        await Effect.runPromise(
          joinSharedDocument({
            attachSharedDocument,
            rememberShare: (url) =>
              rememberShare({ ...shareKey, shareUrl: url }),
          })(joinedShareUrl)
        );
        setIsJoinSharedDocumentDialogOpen(false);
      } catch (error) {
        console.error(error);
        dispatchNotification(
          createErrorNotification({
            title: 'Join Shared Document Error',
            message: 'This shared document link could not be joined.',
          })
        );
      }
    },
    [
      shareKey,
      liveDocument,
      attachSharedDocument,
      rememberShare,
      dispatchNotification,
    ]
  );

  const handleLeaveSharedDocument = useCallback(async () => {
    if (!shareKey || !shareUrl || !liveDocument) return;

    await Effect.runPromise(
      leaveSharedDocumentCommand({
        forgetShare: () => forgetShare(shareKey),
        // A fresh private document seeded from the live content: leaving
        // changes who else sees the document, not what it holds.
        detachToPrivate: pipe(
          Effect.all({
            repo: Effect.promise(getHostRepo),
            current: SubscriptionRef.get(liveDocument.content),
          }),
          Effect.flatMap(({ repo, current }) =>
            startDocument({ repo, content: current.doc.content })
          ),
          Effect.flatMap(
            (handle) =>
              concreteLiveDocument.current?.switchTo(handle) ?? Effect.void
          )
        ),
        leaveSharedDocument: projectSync.leaveSharedDocument,
      })(shareUrl)
    ).catch(console.error);
  }, [shareKey, shareUrl, liveDocument, forgetShare, getHostRepo, projectSync]);

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
        shareUrl,
        onShareDocument: handleShareDocument,
        onJoinSharedDocument: handleJoinSharedDocument,
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
