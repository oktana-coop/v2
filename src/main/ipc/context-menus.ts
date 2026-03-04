import { BrowserWindow, ipcMain } from 'electron';

import {
  type ContextMenuPayload,
  EXPLORER_TREE_NODE,
} from '../../modules/infrastructure/cross-platform';
import {
  buildAndShowExplorerDirectoryContextMenu,
  buildAndShowExplorerFileContextMenu,
} from '../menus';

export const registerContextMenusIPCHandlers = ({
  win,
}: {
  win: BrowserWindow;
}) => {
  ipcMain.handle(
    'context-menu:show',
    async (_, payload: ContextMenuPayload) => {
      if (payload.context === EXPLORER_TREE_NODE) {
        if (payload.nodeType === 'FILE') {
          buildAndShowExplorerFileContextMenu({
            win,
            path: payload.path,
          });
        }

        if (payload.nodeType === 'DIRECTORY') {
          buildAndShowExplorerDirectoryContextMenu({ win, path: payload.path });
        }
      }
    }
  );
};
