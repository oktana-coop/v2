import { useCallback, useContext, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { urlEncodeShareId } from '../../../../modules/domain/project';
import { uniqueParticipants } from '../../../../modules/domain/rich-text';
import { GuestEditingContext, useRemotePresence } from '../../app-state';
import { SidebarLayout } from '../../components/layout/SidebarLayout';
import { StackedResizablePanelsLayout } from '../../components/layout/StackedResizablePanelsLayout';
import { JoinSharedDocumentDialog } from '../project/current-project/sharing-dialogs';
import { GuestCommandPalette } from './GuestCommandPalette';
import { GuestSharesList } from './GuestSharesList';
import { GuestSharingDialog } from './GuestSharingDialog';

export const SharedDocuments = () => {
  const {
    shareId,
    liveDocument,
    isSharingDialogOpen,
    onCloseSharingDialog,
    onLeave,
    isJoinDialogOpen,
    onCloseJoinDialog,
  } = useContext(GuestEditingContext);
  const navigate = useNavigate();
  const peers = useRemotePresence(liveDocument);
  const participants = useMemo(
    () => uniqueParticipants(peers.map((peer) => peer.participant)),
    [peers]
  );

  const handleJoin = useCallback(
    async (joinedShareId: string) => {
      onCloseJoinDialog();
      navigate(`/shared-documents/${urlEncodeShareId(joinedShareId)}`);
      return null;
    },
    [navigate, onCloseJoinDialog]
  );

  return (
    <div className="flex h-full flex-auto flex-col">
      <div className="flex flex-auto overflow-y-auto">
        <JoinSharedDocumentDialog
          isOpen={isJoinDialogOpen}
          description="Paste the share ID you were sent. It opens the shared document here, without its project."
          onJoin={handleJoin}
          onCancel={onCloseJoinDialog}
        />
        <GuestSharingDialog
          isOpen={isSharingDialogOpen}
          shareId={shareId}
          participants={participants}
          onLeave={async () => {
            if (shareId) await onLeave(shareId);
          }}
          onCancel={onCloseSharingDialog}
        />
        <GuestCommandPalette />
        <SidebarLayout
          sidebar={
            <StackedResizablePanelsLayout autoSaveId="shared-documents-panel-group">
              <GuestSharesList />
            </StackedResizablePanelsLayout>
          }
        >
          <Outlet />
        </SidebarLayout>
      </div>
    </div>
  );
};
