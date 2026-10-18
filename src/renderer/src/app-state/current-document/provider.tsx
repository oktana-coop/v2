import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ConvergentDocumentChangeErrorTag,
  ConvergentDocumentUnavailableErrorTag,
  type DocumentSharing,
  type EditableLiveDocument,
  type LocalEditsContributionError,
  type OpenSharedDocumentError,
  SharedDocumentUnavailableError,
  type ShareId,
} from '../../../../modules/domain/collaboration';
import { createPrivateConvergentDocument as createPrivatePlainTextConvergentDocument } from '../../../../modules/domain/plain-text/adapters/automerge-convergent-document';
import {
  artifactKinds,
  type DocumentShareKey,
  getArtifactName,
  joinSharedDocument,
  leaveSharedDocument as leaveSharedDocumentCommand,
  openLivePlainTextDocument,
  openLiveRichTextDocument,
  SharedDocumentNotInProjectErrorTag,
  SharedDocumentOnAnotherBranchErrorTag,
  shareLiveDocument,
  type ShareLiveDocumentArgs,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { createPrivateConvergentDocument as createPrivateRichTextConvergentDocument } from '../../../../modules/domain/rich-text/adapters/automerge-convergent-document';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  type Notification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type Branch,
  urlEncodeArtifactId,
} from '../../../../modules/infrastructure/version-control';
import { subscribeToStream } from '../../../../utils/effect';
import { ProjectContext } from '../';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { ShareRegistryContext } from '../share-registry';
import { CurrentDocumentContext } from './context';
import {
  type CurrentDocument,
  type CurrentPlainTextDocument,
  type CurrentRichTextDocument,
  type JoinSharedDocumentRefusal,
} from './types';
import {
  useCurrentDocumentId,
  useCurrentDocumentKind,
} from './use-current-document-id';
import { usePublishLocalPresence } from './use-presence';
import { usePulledUpstreamChanges } from './use-pulled-upstream-changes';

// Sharing and leaving the open document, through its own kind's sharing.
type OpenedDocumentSharing = {
  share: (args: ShareLiveDocumentArgs) => Effect.Effect<ShareId, unknown>;
  leave: (
    shareKey: DocumentShareKey
  ) => Effect.Effect<void, LocalEditsContributionError>;
};

type OpenedDocument = (
  | Pick<CurrentRichTextDocument, 'kind' | 'liveDocument'>
  | Pick<CurrentPlainTextDocument, 'kind' | 'liveDocument'>
) &
  OpenedDocumentSharing;

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
    switchToBranch,
    listBranches,
  } = useContext(ProjectContext);
  const { privateRepo, documentSharing, sharedDocumentResolver } = useContext(
    InfrastructureAdaptersContext
  );
  const {
    registry: { findShareId, rememberShare, forgetShare },
  } = useContext(ShareRegistryContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const navigate = useNavigate();
  const documentId = useCurrentDocumentId();
  const documentKind = useCurrentDocumentKind();
  const { pulledUpstreamChanges, resetPulledUpstreamChanges } =
    usePulledUpstreamChanges();
  const [openedDocument, setOpenedDocument] = useState<OpenedDocument | null>(
    null
  );
  const liveDocument = openedDocument?.liveDocument ?? null;
  const onRichTextSelectionChange = usePublishLocalPresence(
    openedDocument?.kind === artifactKinds.RICH_TEXT_DOCUMENT
      ? openedDocument.liveDocument
      : null
  );
  const onPlainTextSelectionChange = usePublishLocalPresence(
    openedDocument?.kind === artifactKinds.PLAIN_TEXT_DOCUMENT
      ? openedDocument.liveDocument
      : null
  );
  const currentDocument = useMemo((): CurrentDocument | null => {
    if (!openedDocument) return null;

    return openedDocument.kind === artifactKinds.RICH_TEXT_DOCUMENT
      ? {
          kind: openedDocument.kind,
          liveDocument: openedDocument.liveDocument,
          onLocalSelectionChange: onRichTextSelectionChange,
        }
      : {
          kind: openedDocument.kind,
          liveDocument: openedDocument.liveDocument,
          onLocalSelectionChange: onPlainTextSelectionChange,
        };
  }, [openedDocument, onRichTextSelectionChange, onPlainTextSelectionChange]);
  const [isShareDocumentDialogOpen, setIsShareDocumentDialogOpen] =
    useState<boolean>(false);
  const [isJoinSharedDocumentDialogOpen, setIsJoinSharedDocumentDialogOpen] =
    useState<boolean>(false);

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
    if (!projectStore || !projectId || !documentId || !documentKind) {
      setOpenedDocument(null);
      return;
    }

    if (
      documentKind === artifactKinds.RICH_TEXT_DOCUMENT &&
      !representationTransformAdapter
    ) {
      setOpenedDocument(null);
      return;
    }

    // Ignore an open the selection has already moved on from.
    let cancelled = false;
    let opened: OpenedDocument | null = null;

    const close = ({ liveDocument: handle }: OpenedDocument) =>
      Effect.runPromise(handle.close).catch((error) => {
        console.error(error);
        dispatchNotification(
          createErrorNotification({
            title: 'Save Document Error',
            message: 'Your latest changes could not be saved.',
          })
        );
      });

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

    // Binds the document to its kind's sharing, so nothing later has to tell
    // the kinds apart to share or leave it.
    const bindSharing = <DocumentType, ParticipantSelectionType>({
      liveDocument: handle,
      sharingAdapter,
    }: {
      liveDocument: Pick<
        EditableLiveDocument<DocumentType>,
        'currentDocument' | 'attachTo' | 'applyPendingLocalEdits' | 'detach'
      >;
      sharingAdapter: Pick<
        DocumentSharing<DocumentType, ParticipantSelectionType>,
        'shareDocument' | 'leaveSharedDocument'
      >;
    }): OpenedDocumentSharing => ({
      share: shareLiveDocument({
        liveDocument: handle,
        shareDocument: sharingAdapter.shareDocument,
        rememberShare,
      }),
      leave: leaveSharedDocumentCommand({
        liveDocument: handle,
        findShareId,
        forgetShare,
        leaveSharedDocument: sharingAdapter.leaveSharedDocument,
      }),
    });

    const args = { projectId, documentId, shareId: shareId ?? undefined };

    const open = (): Effect.Effect<OpenedDocument, unknown> =>
      documentKind === artifactKinds.RICH_TEXT_DOCUMENT &&
      representationTransformAdapter
        ? pipe(
            openLiveRichTextDocument({
              createPrivateDocument: (initialDocument) =>
                createPrivateRichTextConvergentDocument({
                  initialDocument,
                  privateRepo,
                }),
              openSharedDocument:
                documentSharing[artifactKinds.RICH_TEXT_DOCUMENT]
                  .openSharedDocument,
              onShareUnavailable: reportShareFailure,
              transformToText: representationTransformAdapter.transformToText,
              findRichTextDocumentById: projectStore.findRichTextDocumentById,
              updateRichTextDocumentContent:
                projectStore.updateRichTextDocumentContent,
              projectContentChangeEvents:
                projectStore.projectContentChangeEvents,
            })(args),
            Effect.map((handle): OpenedDocument => ({
              kind: artifactKinds.RICH_TEXT_DOCUMENT,
              liveDocument: handle,
              ...bindSharing({
                liveDocument: handle,
                sharingAdapter:
                  documentSharing[artifactKinds.RICH_TEXT_DOCUMENT],
              }),
            }))
          )
        : pipe(
            openLivePlainTextDocument({
              createPrivateDocument: (initialDocument) =>
                createPrivatePlainTextConvergentDocument({
                  initialDocument,
                  privateRepo,
                }),
              openSharedDocument:
                documentSharing[artifactKinds.PLAIN_TEXT_DOCUMENT]
                  .openSharedDocument,
              onShareUnavailable: reportShareFailure,
              findPlainTextDocumentById: projectStore.findPlainTextDocumentById,
              updatePlainTextDocumentContent:
                projectStore.updatePlainTextDocumentContent,
              projectContentChangeEvents:
                projectStore.projectContentChangeEvents,
            })(args),
            Effect.map((handle): OpenedDocument => ({
              kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
              liveDocument: handle,
              ...bindSharing({
                liveDocument: handle,
                sharingAdapter:
                  documentSharing[artifactKinds.PLAIN_TEXT_DOCUMENT],
              }),
            }))
          );

    Effect.runPromise(open())
      .then((handle) => {
        if (cancelled) {
          close(handle);
          return;
        }
        opened = handle;
        setOpenedDocument(handle);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        // TODO: Decide how a document that can't be read is shown; today a
        // plain-text file that isn't UTF-8 ends up here, with the page left
        // on its skeleton.
        dispatchNotification(
          createErrorNotification({
            title: 'Open Document Error',
            message:
              'This document could not be opened. It may have been moved or deleted.',
          })
        );
        setOpenedDocument(null);
      });

    return () => {
      cancelled = true;
      if (opened) close(opened);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentId,
    documentKind,
    projectId,
    projectStore,
    representationTransformAdapter,
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

  const handleShareDocument = useCallback(async (): Promise<ShareId | null> => {
    if (!shareKey || !openedDocument || !currentArtifact) return null;

    try {
      return await Effect.runPromise(
        openedDocument.share({
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
  }, [shareKey, openedDocument, currentArtifact, dispatchNotification]);

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
            getSharedDocumentKind: sharedDocumentResolver.getSharedDocumentKind,
            getArtifactMetaDataById: projectStore.getArtifactMetaDataById,
            getSharedDocumentInfo: {
              [artifactKinds.RICH_TEXT_DOCUMENT]:
                documentSharing[artifactKinds.RICH_TEXT_DOCUMENT]
                  .getSharedDocumentInfo,
              [artifactKinds.PLAIN_TEXT_DOCUMENT]:
                documentSharing[artifactKinds.PLAIN_TEXT_DOCUMENT]
                  .getSharedDocumentInfo,
            },
            lookupArtifactInProject: projectStore.lookupArtifactInProject,
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
      sharedDocumentResolver,
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
    if (!shareKey || !shareId || !openedDocument) return;

    try {
      await Effect.runPromise(openedDocument.leave(shareKey));
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
  }, [shareKey, shareId, openedDocument, dispatchNotification]);

  return (
    <CurrentDocumentContext.Provider
      value={{
        currentDocument,
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
