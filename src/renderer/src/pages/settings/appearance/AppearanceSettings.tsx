import { useEffect } from 'react';

import { Breadcrumb } from '../../../components/navigation/Breadcrumb';
import { SettingsActionsBar } from '../SettingsActionsBar';
import { EditorAppearanceSection } from './EditorAppearanceSection';
import { ThemeSection } from './ThemeSection';
import { UIAppearanceSection } from './UIAppearanceSection';

export const AppearanceSettings = () => {
  useEffect(() => {
    document.title = 'v2 | Appearance Settings';
  }, []);

  return (
    <>
      <SettingsActionsBar>
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: 'Appearance' },
          ]}
        />
      </SettingsActionsBar>
      <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-12">
        <ThemeSection />
        <EditorAppearanceSection />
        <UIAppearanceSection />
      </div>
    </>
  );
};
