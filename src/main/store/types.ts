import type Store from 'electron-store';

import type { Email, GithubUserInfo, Username } from '../../modules/auth/node';
import type { EditorAppearancePreferences } from '../../modules/personalization/appearance/editor';
import type { Theme } from '../../modules/personalization/appearance/theme';
import type { UIAppearancePreferences } from '../../modules/personalization/appearance/ui';
import type { ExportTemplatePreferences } from '../../modules/personalization/export-templates';

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
  exports: ExportTemplatePreferences;
  schemaVersion: number;
};

export type UserPreferencesStore = Store<UserPreferences>;
