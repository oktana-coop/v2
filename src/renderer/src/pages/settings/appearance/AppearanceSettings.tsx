import { EditorAppearanceSection } from './EditorAppearanceSection';
import { ThemeSection } from './ThemeSection';
import { UIAppearanceSection } from './UIAppearanceSection';

export const AppearanceSettings = () => (
  <div className="container mx-auto my-6 flex max-w-2xl flex-col gap-12">
    <ThemeSection />
    <EditorAppearanceSection />
    <UIAppearanceSection />
  </div>
);
