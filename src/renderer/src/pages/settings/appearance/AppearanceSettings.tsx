import { FontSection } from './FontSection';
import { ThemeSection } from './ThemeSection';

export const AppearanceSettings = () => (
  <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-12">
    <ThemeSection />
    <FontSection />
  </div>
);
