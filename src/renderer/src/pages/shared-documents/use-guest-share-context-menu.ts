import { useEffect } from 'react';

import { GUEST_SHARE } from '../../../../modules/infrastructure/cross-platform';

export const useGuestShareContextMenu = ({
  onRename,
  onLeave,
}: {
  onRename: (shareId: string) => void;
  onLeave: (shareId: string) => Promise<void>;
}): void => {
  useEffect(() => {
    const unsubscribe = window.electronAPI.onContextMenuAction((action) => {
      if (action.context !== GUEST_SHARE) return;

      if (action.action.type === 'RENAME') onRename(action.action.shareId);
      if (action.action.type === 'LEAVE') onLeave(action.action.shareId);
    });

    return unsubscribe;
  }, [onRename, onLeave]);
};
