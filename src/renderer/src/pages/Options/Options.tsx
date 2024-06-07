import { useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { ThemeSection } from './ThemeSection';

export const Options = () => {
  useEffect(() => {
    document.title = 'v2 | Options';
  }, []);

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto my-6">
        <ThemeSection />
      </div>
    </Layout>
  );
};
