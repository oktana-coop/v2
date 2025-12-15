import { useEffect } from 'react';

import { GenericCommandPalette } from '../../components/dialogs/command-palette';
import { AuthorInfoSection } from './AuthorInfoSection';
import { ThemeSection } from './ThemeSection';

export const Options = () => {
  useEffect(() => {
    document.title = 'v2 | Options';
  }, []);

  return (
    <>
      <div className="container mx-auto my-6 max-w-2xl">
        <div className="mb-12">
          <AuthorInfoSection />
        </div>
        <div className="mb-12">
          <ThemeSection />
        </div>
      </div>
      <GenericCommandPalette />
    </>
  );
};
