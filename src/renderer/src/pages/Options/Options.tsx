import { useEffect } from 'react';
import { ThemeSection } from './ThemeSection';

export const Options = () => {
  useEffect(() => {
    document.title = 'v2 | Options';
  }, []);

  return (
    <div className="container max-w-2xl mx-auto my-6">
      <ThemeSection />
    </div>
  );
};
