import Store from 'electron-store';

import { type Theme, themes } from '../modules/personalization/theme';

export type UserPreferencesStore = Store<UserPreferences>;

export type UserPreferences = {
  theme: Theme;
};

const schema = {
  theme: {
    type: 'string',
    enum: [themes.system, themes.light, themes.dark],
    default: themes.system,
  },
};

export const initializeStore = () => {
  const store = new Store<UserPreferences>({ schema });
  return store;
};
