import * as Effect from 'effect/Effect';
import Store from 'electron-store';

import { defaultEditorAppearance } from '../../modules/personalization/appearance/editor';
import { themes } from '../../modules/personalization/appearance/theme';
import { defaultUIAppearance } from '../../modules/personalization/appearance/ui';
import { defaultExportTemplatePreferences } from '../../modules/personalization/export-templates';
import { CURRENT_SCHEMA_VERSION, migrateStore } from './migrations';
import { type UserPreferences } from './types';

export {
  CURRENT_SCHEMA_VERSION,
  migrations,
  migrateStore,
  type Migration,
} from './migrations';

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
          matchExportTemplate: {
            type: 'boolean',
            default: defaultAppearance.editor.matchExportTemplate,
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
  exports: {
    type: 'object',
    default: defaultExportTemplatePreferences,
    properties: {
      activeTemplateId: {
        type: 'string',
        default: defaultExportTemplatePreferences.activeTemplateId,
      },
      templates: {
        type: 'array',
        default: defaultExportTemplatePreferences.templates,
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
  schemaVersion: {
    type: 'number',
    default: CURRENT_SCHEMA_VERSION,
  },
};

export const initializeStore = () => {
  const store = new Store<UserPreferences>({ schema });
  Effect.runSync(migrateStore(store));
  return store;
};

export * from './types';
