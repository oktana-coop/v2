import { useEffect } from 'react';

import { GenericCommandPalette } from '../../components/dialogs/command-palette';
import { AuthorInfoSection } from './AuthorInfoSection';
import { SyncProvidersSection } from './sync-providers/SyncProvidersSection';
import { ThemeSection } from './ThemeSection';

export const Options = () => {
  useEffect(() => {
    document.title = 'v2 | Options';
  }, []);

  return (
    <>
      <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-16">
        <AuthorInfoSection />
        <SyncProvidersSection />
        <ThemeSection />
      </div>
      <GenericCommandPalette />
    </>
  );
};
