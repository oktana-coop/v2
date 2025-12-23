import { useContext } from 'react';

import { ElectronContext } from '../../../../../modules/infrastructure/cross-platform/browser';
import { CommandPaletteContext } from '../../../app-state';
import { useClearWebStorage } from '../../../hooks';
import { type ActionOption, CommandPalette } from './CommandPalette';

export const GenericCommandPalette = () => {
  const { isOpen: isCommandPaletteOpen, closeCommandPalette } = useContext(
    CommandPaletteContext
  );
  const { isElectron, checkForUpdate } = useContext(ElectronContext);

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
