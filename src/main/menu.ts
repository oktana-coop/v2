import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  shell,
} from 'electron';

import { checkForUpdates } from './update';

const sendIPCMessageToFocusedWindow = (message: string) => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    focused.webContents.send(message);
  }
};

export const buildMenu = () => {
  const isMac = process.platform === 'darwin';

  const appMenuSubmenu: MenuItemConstructorOptions[] = [
    { role: 'about' },
    {
      label: 'Check for Updates',
      click: checkForUpdates,
    },
    { type: 'separator' },
    { role: 'services' },
    { type: 'separator' },
    { role: 'hide' },
    { role: 'hideOthers' },
    { role: 'unhide' },
    { type: 'separator' },
    { role: 'quit' },
  ];

  const editMenuSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Command Palette…',
      accelerator: isMac ? 'Cmd+K' : 'Ctrl+K',
      click: () => sendIPCMessageToFocusedWindow('open-command-palette'),
    },
    { type: 'separator' },
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    ...(isMac
      ? ([
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
          },
        ] as MenuItemConstructorOptions[])
      : ([
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ] as MenuItemConstructorOptions[])),
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: appMenuSubmenu,
          },
        ]
      : []),
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: editMenuSubmenu,
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://electronjs.org');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
};
