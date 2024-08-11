import { useEffect } from 'react';

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
    </Layout>
  );
};
