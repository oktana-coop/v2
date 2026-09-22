import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  leaveDocumentAsGuest,
  type LiveDocument,
  type NamedLiveDocument,
  openDocumentAsGuest,
  SharedDocumentUnavailableErrorTag,
  type ShareId,
} from '../../../../modules/domain/project';
import { createPrivateConvergentDocument } from '../../../../modules/domain/rich-text/adapters/automerge-convergent-document';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  type Notification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { usePublishLocalPresence } from '../current-document/use-presence';
import { GuestShareRegistryContext } from '../guest-share-registry';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { GuestEditingContext } from './context';
import { useCurrentShareId } from './use-current-share-id';

// How opening the share in the route went: the document, or what to tell the
// user. The entry stays listed either way; leaving is the user's call.
type OpenOutcome =
  | { document: NamedLiveDocument }
  | { document: null; notification: Notification };

export const GuestEditingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { privateRepo, documentSharing } = useContext(
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

  const [liveDocument, setLiveDocument] = useState<NamedLiveDocument | null>(
    null
  );
  // The document to close when the route moves on, unless leaving closed it.
  const openedRef = useRef<LiveDocument | null>(null);
  const onLocalSelectionChange = usePublishLocalPresence(liveDocument);
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  useEffect(() => {
    if (!shareId || !representationTransformAdapter) {
      setLiveDocument(null);
      return;
    }

    let cancelled = false;

    const close = (document: LiveDocument) =>
      Effect.runPromise(document.close).catch(console.error);

    Effect.runPromise(
      pipe(
        openDocumentAsGuest({
          getSharedDocumentInfo: documentSharing.getSharedDocumentInfo,
          openSharedDocument: documentSharing.openSharedDocument,
          createPrivateDocument: (initialText) =>
            createPrivateConvergentDocument({ initialText, privateRepo }),
          transformToText: representationTransformAdapter.transformToText,
        })({ shareId }),
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
        setLiveDocument(outcome.document);
        guestShareRegistry.rememberShare({
          shareId,
          sharedName: outcome.document.name,
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
  }, [shareId, representationTransformAdapter, documentSharing, privateRepo]);

  const remembered = guestShares.find((share) => share.shareId === shareId);
  const name = liveDocument ? (remembered?.name ?? liveDocument.name) : null;

  const onLeave = useCallback(
    async (target: ShareId) => {
      if (target === shareId && liveDocument) {
        await Effect.runPromise(
          leaveDocumentAsGuest({
            liveDocument,
            forgetShare: () => guestShareRegistry.forgetShare(target),
            leaveSharedDocument: documentSharing.leaveSharedDocument,
          })(target)
        ).catch(console.error);

        openedRef.current = null;
        setLiveDocument(null);
        setIsSharingDialogOpen(false);
        navigate('/shared-documents');
      } else {
        guestShareRegistry.forgetShare(target);
        await Effect.runPromise(
          documentSharing.leaveSharedDocument({ shareId: target })
        ).catch(console.error);
      }
    },
    [shareId, liveDocument, guestShareRegistry, documentSharing, navigate]
  );

  return (
    <GuestEditingContext.Provider
      value={{
        shareId,
        liveDocument,
        name,
        onLocalSelectionChange,
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
