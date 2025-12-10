import Store from 'electron-store';

import { type Email, type Username } from '../modules/auth/node';
import { type Theme, themes } from '../modules/personalization/theme';

export type UserPreferencesStore = Store<UserPreferences>;

export type UserPreferences = {
  theme: Theme;
  auth: {
    username: Username | null;
    email: Email | null;
  };
};

const schema = {
  theme: {
    type: 'string',
    enum: [themes.system, themes.light, themes.dark],
    default: themes.system,
  },
  auth: {
    type: 'object',
    properties: {
      username: {
        oneOf: [{ type: 'string' }, { type: 'null' }],
        default: null,
      },
      email: {
        oneOf: [{ type: 'string' }, { type: 'null' }],
        default: null,
      },
    },
  },
};

export const initializeStore = () => {
  const store = new Store<UserPreferences>({ schema });
  return store;
};
