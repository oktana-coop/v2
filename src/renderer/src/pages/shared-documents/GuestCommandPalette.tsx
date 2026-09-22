import { useContext } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeShareId } from '../../../../modules/domain/project';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  CommandPaletteContext,
  GuestEditingContext,
  GuestShareRegistryContext,
  useClearWebStorage,
} from '../../app-state';
import { CommandPalette } from '../../components/dialogs/command-palette';

export const GuestCommandPalette = () => {
  const { isOpen, closeCommandPalette } = useContext(CommandPaletteContext);
  const {
    shareId,
    liveDocument,
    onOpenSharingDialog,
    onLeave,
    onOpenJoinDialog,
  } = useContext(GuestEditingContext);
  const { guestShares } = useContext(GuestShareRegistryContext);
  const { checkForUpdate } = useContext(ElectronContext);
  const clearWebStorage = useClearWebStorage();
  const navigate = useNavigate();

  const otherShares = guestShares.filter((share) => share.shareId !== shareId);

  const documentActions = [
    { name: 'Sharing options', onActionSelection: onOpenSharingDialog },
    {
      name: 'Leave shared document',
      onActionSelection: () => {
        if (shareId) onLeave(shareId);
      },
    },
  ];

  const generalActions = [
    { name: 'Join shared document', onActionSelection: onOpenJoinDialog },
    { name: 'Check for updates', onActionSelection: checkForUpdate },
    { name: 'Clear application data', onActionSelection: clearWebStorage },
  ];

  return (
    <CommandPalette
      open={isOpen}
      onClose={closeCommandPalette}
      documentsGroupTitle="Shared with me"
      contextualSection={
        liveDocument
          ? {
              groupTitle: `Current document: ${name}`,
              actions: documentActions,
            }
          : undefined
      }
      documents={otherShares.map((share) => ({
        id: share.shareId,
        title: share.name,
        onDocumentSelection: () => {
          navigate(`/shared-documents/${urlEncodeShareId(share.shareId)}`);
          closeCommandPalette();
        },
      }))}
      actions={generalActions}
    />
  );
};
