import { useContext } from 'react';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform';
import { CommandPaletteContext } from '../../../app-state';
import { useClearWebStorage } from '../../../hooks';
import { useDocumentSelection as useDocumentSelectionInSingleDocumentProject } from '../../../hooks/single-document-project';
import { type ActionOption, CommandPalette } from './CommandPalette';

export const GenericCommandPalette = () => {
  const { isOpen: isCommandPaletteOpen, closeCommandPalette } = useContext(
    CommandPaletteContext
  );

  const { isElectron, checkForUpdate } = useContext(ElectronContext);

  useDocumentSelectionInSingleDocumentProject();
  const clearWebStorage = useClearWebStorage();

  const electronSpecificActions: ActionOption[] = [
    {
      name: 'Check for updates',
      onActionSelection: checkForUpdate,
    },
    {
      name: 'Clear application data',
      onActionSelection: clearWebStorage,
    },
  ];

  const browserSpecificActions: ActionOption[] = [];

  const generalActions = [
    ...(isElectron ? electronSpecificActions : browserSpecificActions),
  ];

  return (
    <CommandPalette
      open={isCommandPaletteOpen}
      onClose={closeCommandPalette}
      actions={generalActions}
    />
  );
};
