import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMatch, useNavigate } from 'react-router';

import {
  commitDocument,
  discardDocumentChanges,
  getDocumentVersioningState,
  type PendingEditsNotSavedError,
  PendingEditsNotSavedErrorTag,
  type ProjectId,
  type ProjectRelPath,
  restoreDocumentVersion,
  urlEncodeProjectId,
} from '../../../../../../modules/domain/project';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type Commit,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  urlEncodeChangeIdForChange,
} from '../../../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/functionality-config/context';
import { CurrentDocumentContext } from '../../../current-document/context';
import { useCurrentDocumentId } from '../../../current-document/use-current-document-id';
import { ProjectContext } from '../../context';
import { CurrentArtifactVersioningContext } from './context';
import {
  buildSkippedAssetsOnCommitNotification,
  buildSkippedAssetsOnRestoreNotification,
} from './skipped-assets-notifications';

const findChangeIndex = ({
  changeId,
  history,
}: {
  changeId: ChangeId;
  history: ChangeWithUrlInfo[];
}) => history.findIndex((change) => changeIdsAreSame(change.id, changeId));

const buildChangeUrl = ({
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
  const selectedIndex = findChangeIndex({ changeId, history });
  const isInitialChange = selectedIndex === history.length - 1;
  const diffChange = isInitialChange ? null : history[selectedIndex + 1];

  const changeUrl = `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(documentId)}/changes/${urlEncodeChangeId(changeId)}`;

  if (!diffChange) return changeUrl;

  const diffUrl = `${changeUrl}?diffWith=${urlEncodeChangeIdForChange(diffChange)}`;

  return showDiffInHistoryView ? `${diffUrl}&showDiff=true` : diffUrl;
};

export const CurrentArtifactVersioningProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { projectId, projectStore, subscribeToProjectContentChangeEvents } =
    useContext(ProjectContext);
  const { liveDocument } = useContext(CurrentDocumentContext);
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();
  const documentId = useCurrentDocumentId();
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [canCommit, setCanCommit] = useState(false);
  const [isRestoreCommitDialogOpen, setIsRestoreCommitDialogOpen] =
    useState<boolean>(false);
  const [isDiscardChangesDialogOpen, setIsDiscardChangesDialogOpen] =
    useState<boolean>(false);
  const [commitToRestore, setCommitToRestore] = useState<Commit | null>(null);

  const documentChangeSubRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/changes/:changeId'
  );

  // A load finishing after the selection moved on must not overwrite the
  // state of the document now selected.
  const latestDocumentId = useRef(documentId);

  useEffect(() => {
    latestDocumentId.current = documentId;
  }, [documentId]);

  // During a switch the live document can still be the previous one.
  const openDocument =
    liveDocument && liveDocument.documentId === documentId
      ? liveDocument
      : null;

  const applyVersioningState = useCallback(
    ({
      documentId: loadedDocumentId,
      history,
      canCommit: committable,
    }: {
      documentId: ArtifactId;
      history: ChangeWithUrlInfo[];
      canCommit: boolean;
    }) => {
      if (latestDocumentId.current !== loadedDocumentId) return;

      setVersionedDocumentHistory(history);
      setCanCommit(committable);
      setLoadingHistory(false);
    },
    []
  );

  const reloadHistory = useMemo(() => {
    if (!documentId || !projectStore || !projectId) {
      return Effect.succeed<ChangeWithUrlInfo[]>([]);
    }

    // Loads run one at a time, so a load can't overwrite the result of one that
    // started after it.
    return Effect.unsafeMakeSemaphore(1).withPermits(1)(
      pipe(
        getDocumentVersioningState({
          getDocumentHistory: projectStore.getDocumentHistory,
          isContentSameAtChanges: projectStore.isContentSameAtChanges,
        })({ projectId, documentId }),
        Effect.map((state) => ({
          ...state,
          history: state.history.map((change): ChangeWithUrlInfo => ({
            ...change,
            urlEncodedChangeId: urlEncodeChangeIdForChange(change),
          })),
        })),
        Effect.tap((state) =>
          Effect.sync(() => applyVersioningState({ documentId, ...state }))
        ),
        Effect.map(({ history }) => history)
      )
    );
  }, [documentId, projectId, projectStore, applyVersioningState]);

  useEffect(() => {
    if (!documentId) return;

    setLoadingHistory(true);

    Effect.runPromise(reloadHistory).catch((error) => {
      console.error(error);
      if (latestDocumentId.current === documentId) setLoadingHistory(false);
    });

    const reloadAfterChanges = debounce(() => {
      Effect.runPromise(reloadHistory).catch(console.error);
    }, 450);

    const unsubscribe = subscribeToProjectContentChangeEvents({
      emitOnStart: false,
      onEvent: reloadAfterChanges,
    });

    return () => {
      unsubscribe();
      reloadAfterChanges.clear();
    };
  }, [documentId, reloadHistory, subscribeToProjectContentChangeEvents]);

  const selectChange = useCallback(
    ({
      changeId,
      history,
    }: {
      changeId: ChangeId;
      history: ChangeWithUrlInfo[];
    }) => {
      if (!projectId || !documentId) {
        throw new Error(
          'Cannot select a change since projectId or documentId are not set yet.'
        );
      }

      navigate(
        buildChangeUrl({
          projectId,
          documentId,
          history,
          changeId,
          showDiffInHistoryView,
        })
      );
    },
    [projectId, documentId, showDiffInHistoryView, navigate]
  );

  const handleSelectChange = useCallback(
    (changeId: ChangeId) =>
      selectChange({ changeId, history: versionedDocumentHistory }),
    [selectChange, versionedDocumentHistory]
  );

  const handleCommitDocumentChanges = useCallback(
    async (message: string) => {
      if (!openDocument || !projectStore || !projectId) return false;

      type CommitOutcome =
        | { committed: { skippedAssetPaths: ProjectRelPath[] } }
        | { notSaved: PendingEditsNotSavedError };

      const outcome = await Effect.runPromise(
        pipe(
          commitDocument({
            commitDocumentChanges: projectStore.commitDocumentChanges,
          })({ projectId, openDocument, message }),
          Effect.map(({ skippedAssetPaths }): CommitOutcome => ({
            committed: { skippedAssetPaths },
          })),
          Effect.catchTag(PendingEditsNotSavedErrorTag, (error) =>
            Effect.succeed<CommitOutcome>({ notSaved: error })
          )
        )
      );

      if ('notSaved' in outcome) {
        console.error(outcome.notSaved);
        dispatchNotification(
          createErrorNotification({
            title: 'Commit Error',
            message:
              'Your latest changes could not be saved, so nothing was committed.',
          })
        );
        return false;
      }

      const { skippedAssetPaths } = outcome.committed;

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnCommitNotification(skippedAssetPaths)
        );
      }

      Effect.runPromise(reloadHistory).catch(console.error);

      return true;
    },
    [projectStore, projectId, openDocument, dispatchNotification, reloadHistory]
  );

  const reloadDocumentHistory = useCallback(
    () => Effect.runPromise(Effect.asVoid(reloadHistory)),
    [reloadHistory]
  );

  const handleRestoreCommit = useCallback(
    async ({ message, commit }: { message: string; commit: Commit }) => {
      if (!openDocument || !projectStore || !projectId) {
        throw new Error(
          'Cannot restore commit. Either the document or the project store is not initialized yet.'
        );
      }

      type RestoreOutcome =
        | {
            restored: {
              commitId: Commit['id'];
              history: ChangeWithUrlInfo[];
              skippedAssetPaths: ProjectRelPath[];
            };
          }
        | { notSaved: PendingEditsNotSavedError };

      const outcome = await Effect.runPromise(
        pipe(
          restoreDocumentVersion({
            restoreDocumentChanges: projectStore.restoreDocumentChanges,
          })({ projectId, openDocument, commit, message }),
          Effect.flatMap(({ commitId, skippedAssetPaths }) =>
            pipe(
              reloadHistory,
              Effect.map((history): RestoreOutcome => ({
                restored: { commitId, history, skippedAssetPaths },
              }))
            )
          ),
          Effect.catchTag(PendingEditsNotSavedErrorTag, (error) =>
            Effect.succeed<RestoreOutcome>({ notSaved: error })
          )
        )
      );

      if ('notSaved' in outcome) {
        console.error(outcome.notSaved);
        dispatchNotification(
          createErrorNotification({
            title: 'Restore Version Error',
            message:
              'Your latest changes could not be saved, so this version was not restored.',
          })
        );
        return;
      }

      const { commitId, history, skippedAssetPaths } = outcome.restored;

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnRestoreNotification(skippedAssetPaths)
        );
      }

      setIsRestoreCommitDialogOpen(false);
      selectChange({ changeId: commitId, history });
    },
    [
      projectStore,
      projectId,
      openDocument,
      dispatchNotification,
      reloadHistory,
      selectChange,
    ]
  );

  const handleDiscardChanges = useCallback(async () => {
    if (!openDocument || !projectStore || !projectId) {
      throw new Error(
        'Cannot discard changes. Either the document or the project store is not initialized yet.'
      );
    }

    const history = await Effect.runPromise(
      pipe(
        discardDocumentChanges({
          discardUncommittedChanges: projectStore.discardUncommittedChanges,
        })({ projectId, openDocument }),
        Effect.zipRight(reloadHistory)
      )
    );

    if (documentChangeSubRouteMatch) {
      const [lastCommit] = history;
      selectChange({ changeId: lastCommit.id, history });
    }

    setIsDiscardChangesDialogOpen(false);
  }, [
    projectStore,
    projectId,
    openDocument,
    reloadHistory,
    documentChangeSubRouteMatch,
    selectChange,
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

  const value = useMemo(
    () => ({
      versionedDocumentId: documentId,
      loadingHistory,
      versionedDocumentHistory,
      canCommit,
      onSelectChange: handleSelectChange,
      onCommitDocumentChanges: handleCommitDocumentChanges,
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
    }),
    [
      documentId,
      loadingHistory,
      versionedDocumentHistory,
      canCommit,
      handleSelectChange,
      handleCommitDocumentChanges,
      reloadDocumentHistory,
      handleRestoreCommit,
      handleDiscardChanges,
      commitToRestore,
      isRestoreCommitDialogOpen,
      isDiscardChangesDialogOpen,
      handleOpenRestoreCommitDialog,
      handleCloseRestoreCommitDialog,
      handleOpenDiscardChangesDialog,
      handleCloseDiscardChangesDialog,
    ]
  );

  return (
    <CurrentArtifactVersioningContext.Provider value={value}>
      {children}
    </CurrentArtifactVersioningContext.Provider>
  );
};
