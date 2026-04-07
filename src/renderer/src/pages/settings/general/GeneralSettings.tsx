import { useEffect } from 'react';

import { Breadcrumb } from '../../../components/navigation/Breadcrumb';
import { SettingsActionsBar } from '../SettingsActionsBar';
import { AuthorInfoSection } from './AuthorInfoSection';

export const GeneralSettings = () => {
  useEffect(() => {
    document.title = 'v2 | General Settings';
  }, []);

  return (
    <>
      <SettingsActionsBar>
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: 'General' },
          ]}
        />
      </SettingsActionsBar>
      <div className="container mx-auto my-6 max-w-2xl px-4">
        <AuthorInfoSection />
      </div>
    </>
  );
};
