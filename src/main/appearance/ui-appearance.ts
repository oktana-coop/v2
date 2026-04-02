import { ipcMain } from 'electron';
import Store from 'electron-store';

import { type UIAppearancePreferences } from '../../modules/personalization/appearance/ui';
import { type UserPreferences } from '../store';

export const registerUIAppearanceIPCHandlers = ({
  store,
}: {
  store: Store<UserPreferences>;
}) => {
  ipcMain.handle(
    'set-ui-appearance',
    (_, uiAppearance: UIAppearancePreferences) => {
      store.set('appearance.ui', uiAppearance);
    }
  );

  ipcMain.handle('get-ui-appearance', () => store.get('appearance.ui'));
};
