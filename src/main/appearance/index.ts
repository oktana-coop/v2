import { BrowserWindow } from 'electron';
import Store from 'electron-store';

import { type UserPreferences } from '../store';
import { registerEditorAppearanceIPCHandlers } from './editor-appearance';
import { registerThemeIPCHandlers, setSavedOrDefaultTheme } from './theme';
import { registerUIAppearanceIPCHandlers } from './ui-appearance';

export { setSavedOrDefaultTheme };

export const registerAppearanceIPCHandlers = ({
  store,
  win,
}: {
  store: Store<UserPreferences>;
  win: BrowserWindow;
}) => {
  registerThemeIPCHandlers({ store, win });
  registerEditorAppearanceIPCHandlers({ store });
  registerUIAppearanceIPCHandlers({ store });
};
