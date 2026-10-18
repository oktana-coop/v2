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
import { useNavigate } from 'react-router';

import {
  type DocumentSharing,
  leaveDocumentAsGuest,
  SharedDocumentUnavailableErrorTag,
  type ShareId,
  ValidationError,
} from '../../../../modules/domain/collaboration';
import { createPrivateConvergentDocument as createPrivatePlainTextConvergentDocument } from '../../../../modules/domain/plain-text/adapters/automerge-convergent-document';
import {
  artifactKinds,
  isDocumentKind,
  openLivePlainTextDocumentAsGuest,
  openLiveRichTextDocumentAsGuest,
} from '../../../../modules/domain/project';
import { createPrivateConvergentDocument as createPrivateRichTextConvergentDocument } from '../../../../modules/domain/rich-text/adapters/automerge-convergent-document';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  type Notification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { usePublishLocalPresence } from '../current-document/use-presence';
import { GuestShareRegistryContext } from '../guest-share-registry';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import {
  type GuestDocument,
  GuestEditingContext,
  type GuestPlainTextDocument,
  type GuestRichTextDocument,
} from './context';
import { useCurrentShareId } from './use-current-share-id';

type OpenedDocument = (
  | Pick<GuestRichTextDocument, 'kind' | 'liveDocument'>
  | Pick<GuestPlainTextDocument, 'kind' | 'liveDocument'>
) & {
  leaveSharedDocument: DocumentSharing['leaveSharedDocument'];
};

// How opening the share in the route went: the document, or what to tell the
// user. The entry stays listed either way; leaving is the user's call.
type OpenOutcome =
  { document: OpenedDocument } | { document: null; notification: Notification };

export const GuestEditingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { privateRepo, documentSharing, sharedDocumentResolver } = useContext(
    InfrastructureAdaptersContext
  );
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const { guestShares, registry: guestShareRegistry } = useContext(
    GuestShareRegistryContext
  );
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();
  const shareId = useCurrentShareId();

  const [openedDocument, setOpenedDocument] = useState<OpenedDocument | null>(
    null
  );
  // The document to close when the route moves on, unless leaving closed it.
  const openedRef = useRef<OpenedDocument | null>(null);
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
  const guestDocument = useMemo((): GuestDocument | null => {
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
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  useEffect(() => {
    if (!shareId || !representationTransformAdapter) {
      setOpenedDocument(null);
      return;
    }

    let cancelled = false;

    const close = ({ liveDocument: document }: OpenedDocument) =>
      Effect.runPromise(
        pipe(document.applyPendingLocalEdits, Effect.ensuring(document.close))
      ).catch((error) => {
        console.error(error);
        dispatchNotification(
          createErrorNotification({
            title: 'Save Document Error',
            message: 'Your latest changes could not be saved.',
          })
        );
      });

    const open = pipe(
      sharedDocumentResolver.getSharedDocumentKind({ shareId }),
      Effect.flatMap((kind) => {
        if (kind === artifactKinds.RICH_TEXT_DOCUMENT) {
          const sharing = documentSharing[artifactKinds.RICH_TEXT_DOCUMENT];

          return pipe(
            openLiveRichTextDocumentAsGuest({
              getSharedDocumentInfo: sharing.getSharedDocumentInfo,
              openSharedDocument: sharing.openSharedDocument,
              createPrivateDocument: (initialDocument) =>
                createPrivateRichTextConvergentDocument({
                  initialDocument,
                  privateRepo,
                }),
              transformToText: representationTransformAdapter.transformToText,
            })({ shareId }),
            Effect.map((liveDocument): OpenedDocument => ({
              kind: artifactKinds.RICH_TEXT_DOCUMENT,
              liveDocument,
              leaveSharedDocument: sharing.leaveSharedDocument,
            }))
          );
        }

        if (kind === artifactKinds.PLAIN_TEXT_DOCUMENT) {
          const sharing = documentSharing[artifactKinds.PLAIN_TEXT_DOCUMENT];

          return pipe(
            openLivePlainTextDocumentAsGuest({
              getSharedDocumentInfo: sharing.getSharedDocumentInfo,
              openSharedDocument: sharing.openSharedDocument,
              createPrivateDocument: (initialDocument) =>
                createPrivatePlainTextConvergentDocument({
                  initialDocument,
                  privateRepo,
                }),
            })({ shareId }),
            Effect.map((liveDocument): OpenedDocument => ({
              kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
              liveDocument,
              leaveSharedDocument: sharing.leaveSharedDocument,
            }))
          );
        }

        return Effect.fail(
          new ValidationError('The share is not of a document.')
        );
      })
    );

    Effect.runPromise(
      pipe(
        open,
        Effect.map((document): OpenOutcome => ({ document })),
        Effect.catchTag(SharedDocumentUnavailableErrorTag, (error) => {
          console.error(error);

          return Effect.succeed<OpenOutcome>({
            document: null,
            notification: createErrorNotification({
              title: 'Shared Document Error',
              message:
                'The shared document could not be reached. It may be offline, or the share ID may no longer work.',
            }),
          });
        }),
        Effect.catchAll((error) => {
          console.error(error);

          return Effect.succeed<OpenOutcome>({
            document: null,
            notification: createErrorNotification({
              title: 'Shared Document Error',
              message:
                'This shared document cannot be used by this app. It may come from a newer version.',
            }),
          });
        })
      )
    )
      .then((outcome) => {
        if (cancelled) {
          // Ignore an open the route has already moved on from.
          if (outcome.document) close(outcome.document);
          return;
        }

        if (!outcome.document) {
          dispatchNotification(outcome.notification);
          navigate('/shared-documents');
          return;
        }

        openedRef.current = outcome.document;
        setOpenedDocument(outcome.document);
        guestShareRegistry.rememberShare({
          shareId,
          sharedName: outcome.document.liveDocument.name,
          kind: outcome.document.kind,
        });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      const opened = openedRef.current;
      openedRef.current = null;
      if (opened) close(opened);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shareId,
    representationTransformAdapter,
    documentSharing,
    sharedDocumentResolver,
    privateRepo,
    dispatchNotification,
  ]);

  const remembered = guestShares.find((share) => share.shareId === shareId);
  const name = openedDocument
    ? (remembered?.name ?? openedDocument.liveDocument.name)
    : null;

  const onLeave = useCallback(
    async (target: ShareId) => {
      if (target === shareId && openedDocument) {
        // A refused leave keeps the document where the user can still see
        // the typing that could not be saved.
        try {
          await Effect.runPromise(
            leaveDocumentAsGuest({
              liveDocument: openedDocument.liveDocument,
              forgetShare: () => guestShareRegistry.forgetShare(target),
              leaveSharedDocument: openedDocument.leaveSharedDocument,
            })(target)
          );
        } catch (error) {
          console.error(error);
          dispatchNotification(
            createErrorNotification({
              title: 'Leave Shared Document Error',
              message:
                'Your latest changes could not be saved, so this document was not left.',
            })
          );
          return;
        }

        openedRef.current = null;
        setOpenedDocument(null);
        setIsSharingDialogOpen(false);
        navigate('/shared-documents');
      } else {
        // Left through the kind the share said it held when it was opened.
        const listed = guestShares.find((share) => share.shareId === target);
        const kind = listed?.kind ?? null;

        guestShareRegistry.forgetShare(target);

        if (kind && isDocumentKind(kind)) {
          await Effect.runPromise(
            documentSharing[kind].leaveSharedDocument({ shareId: target })
          ).catch(console.error);
        }
      }
    },
    [
      shareId,
      openedDocument,
      guestShares,
      guestShareRegistry,
      documentSharing,
      navigate,
      dispatchNotification,
    ]
  );

  return (
    <GuestEditingContext.Provider
      value={{
        shareId,
        guestDocument,
        name,
        onLeave,
        isSharingDialogOpen,
        onOpenSharingDialog: () => setIsSharingDialogOpen(true),
        onCloseSharingDialog: () => setIsSharingDialogOpen(false),
        isJoinDialogOpen,
        onOpenJoinDialog: () => setIsJoinDialogOpen(true),
        onCloseJoinDialog: () => setIsJoinDialogOpen(false),
      }}
    >
      {children}
    </GuestEditingContext.Provider>
  );
};
