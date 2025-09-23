import { app, Menu, type MenuItemConstructorOptions, shell } from 'electron';

import { checkForUpdates } from './update';

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
    { role: 'editMenu' },
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
