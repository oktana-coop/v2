import Store from 'electron-store';

import {
  type Email,
  type GithubUserInfo,
  type Username,
} from '../modules/auth/node';
import {
  defaultEditorAppearance,
  type EditorAppearancePreferences,
} from '../modules/personalization/appearance/editor';
import {
  type Theme,
  themes,
} from '../modules/personalization/appearance/theme';
import {
  defaultUIAppearance,
  type UIAppearancePreferences,
} from '../modules/personalization/appearance/ui';

export type UserPreferencesStore = Store<UserPreferences>;

export type UserPreferences = {
  appearance: {
    theme: Theme;
    editor: EditorAppearancePreferences;
    ui: UIAppearancePreferences;
  };
  auth: {
    username: Username | null;
    email: Email | null;
    githubUserInfo: GithubUserInfo | null;
  };
};

const defaultAppearance = {
  theme: themes.system,
  editor: defaultEditorAppearance,
  ui: defaultUIAppearance,
};

const schema = {
  appearance: {
    type: 'object',
    default: defaultAppearance,
    properties: {
      theme: {
        type: 'string',
        enum: [themes.system, themes.light, themes.dark],
        default: defaultAppearance.theme,
      },
      editor: {
        type: 'object',
        default: defaultAppearance.editor,
        properties: {
          headingFontFamily: {
            type: 'string',
            default: defaultAppearance.editor.headingFontFamily,
          },
          headingFontWeight: {
            type: 'string',
            default: defaultAppearance.editor.headingFontWeight,
          },
          headingTextSize: {
            type: 'string',
            default: defaultAppearance.editor.headingTextSize,
          },
          bodyFontFamily: {
            type: 'string',
            default: defaultAppearance.editor.bodyFontFamily,
          },
        },
      },
      ui: {
        type: 'object',
        default: defaultAppearance.ui,
        properties: {
          fontFamily: {
            type: 'string',
            default: defaultAppearance.ui.fontFamily,
          },
        },
      },
    },
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
      githubUserInfo: {
        type: ['object', 'null'],
        default: null,
        properties: {
          username: { type: 'string' },
          name: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
            default: null,
          },
          email: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
            default: null,
          },
          avatarUrl: {
            type: 'string',
          },
        },
      },
    },
  },
};

export const initializeStore = () => {
  const store = new Store<UserPreferences>({ schema });
  return store;
};
