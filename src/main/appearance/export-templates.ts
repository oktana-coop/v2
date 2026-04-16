import { ipcMain } from 'electron';
import Store from 'electron-store';

import { type ExportTemplatePreferences } from '../../modules/personalization/export-templates';
import { type UserPreferences } from '../store';

export const registerExportTemplatesIPCHandlers = ({
  store,
}: {
  store: Store<UserPreferences>;
}) => {
  ipcMain.handle('get-export-templates', () => store.get('exports'));

  ipcMain.handle(
    'set-export-templates',
    (_, exportTemplates: ExportTemplatePreferences) => {
      store.set('exports', exportTemplates);
    }
  );
};
