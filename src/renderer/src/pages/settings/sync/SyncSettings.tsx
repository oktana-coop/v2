import { useEffect } from 'react';

import { Breadcrumb } from '../../../components/navigation/Breadcrumb';
import { SettingsActionsBar } from '../SettingsActionsBar';
import { SyncProvidersSection } from './SyncProvidersSection';

export const SyncSettings = () => {
  useEffect(() => {
    document.title = 'v2 | Sync Settings';
  }, []);

  return (
    <>
      <SettingsActionsBar>
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: 'Sync' },
          ]}
        />
      </SettingsActionsBar>
      <div className="container mx-auto my-6 max-w-2xl px-4">
        <SyncProvidersSection />
      </div>
    </>
  );
};
