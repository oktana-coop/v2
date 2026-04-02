import { ipcMain } from 'electron';
import Store from 'electron-store';

import { type EditorAppearancePreferences } from '../../modules/personalization/appearance/editor';
import { type UserPreferences } from '../store';

export const registerEditorAppearanceIPCHandlers = ({
  store,
}: {
  store: Store<UserPreferences>;
}) => {
  ipcMain.on(
    'set-editor-appearance',
    (_, editorAppearance: EditorAppearancePreferences) => {
      store.set('appearance.editor', editorAppearance);
    }
  );

  ipcMain.handle('get-editor-appearance', () => store.get('appearance.editor'));
};
