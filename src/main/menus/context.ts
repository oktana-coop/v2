import {
  type BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron';

import {
  type ContextMenuAction,
  EXPLORER_TREE_DIRECTORY,
  type ExplorerTreeDirectoryAction,
} from '../../modules/infrastructure/cross-platform';
import { isMac } from '../../modules/infrastructure/cross-platform/node';
import { sendIPCMessageToFocusedWindow } from './utils';

export const buildAndShowExplorerFileContextMenu = ({
  win,
  path,
}: {
  win: BrowserWindow;
  path: string;
}) => {
  const menuOptions: MenuItemConstructorOptions[] = [
    {
      label: 'Rename',
      accelerator: isMac() ? 'Enter' : 'F2',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'RENAME',
            path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
    {
      label: 'Delete',
      accelerator: isMac() ? 'Cmd+Backspace' : 'Ctrl+Backspace',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'DELETE',
            path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
  ];

  const menu = Menu.buildFromTemplate(menuOptions);

  menu.popup({ window: win });
};

export const buildAndShowExplorerDirectoryContextMenu = ({
  win,
  path,
}: {
  win: BrowserWindow;
  path: string;
}) => {
  const menuOptions: MenuItemConstructorOptions[] = [
    {
      label: 'New File',
      accelerator: isMac() ? 'Cmd+N' : 'Ctrl+N',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'NEW_FILE',
            parentPath: path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
    {
      label: 'New Folder',
      accelerator: isMac() ? 'Cmd+Option+N' : 'Ctrl+Alt+N',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'NEW_DIRECTORY',
            parentPath: path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
    { type: 'separator' },
    {
      label: 'Rename',
      accelerator: isMac() ? 'Enter' : 'F2',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'RENAME',
            path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
    {
      label: 'Delete',
      accelerator: isMac() ? 'Cmd+Backspace' : 'Ctrl+Backspace',
      click: () =>
        sendIPCMessageToFocusedWindow('context-menu:action', {
          context: EXPLORER_TREE_DIRECTORY,
          action: {
            type: 'DELETE',
            path,
          } as ExplorerTreeDirectoryAction,
        } as ContextMenuAction),
    },
  ];

  const menu = Menu.buildFromTemplate(menuOptions);

  menu.popup({ window: win });
};
