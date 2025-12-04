import { useEffect } from 'react';

import { GenericCommandPalette } from '../../components/dialogs/command-palette';
import { Layout } from '../../components/layout/Layout';
import { ThemeSection } from './ThemeSection';

export const Options = () => {
  useEffect(() => {
    document.title = 'v2 | Options';
  }, []);

  return (
    <Layout>
      <div className="container mx-auto my-6 max-w-2xl">
        <ThemeSection />
      </div>
      <GenericCommandPalette />
    </Layout>
  );
};
