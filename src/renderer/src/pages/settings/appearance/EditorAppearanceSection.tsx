import { useContext } from 'react';

import { EditorAppearanceContext } from '../../../../../modules/personalization/browser';
import { PenIcon } from '../../../components/icons';
import { FontSelector } from '../../shared/settings/FontSelector';
import { SectionHeader } from '../../shared/settings/SectionHeader';

export const EditorAppearanceSection = () => {
  const {
    editorAppearance,
    setEditorHeadingFontFamily,
    setEditorBodyFontFamily,
    availableFonts,
  } = useContext(EditorAppearanceContext);

  return (
    <div>
      <SectionHeader icon={PenIcon} heading="Editor" />
      <div className="flex flex-col gap-4">
        <FontSelector
          label="Heading Font"
          value={editorAppearance.headingFontFamily}
          onChange={setEditorHeadingFontFamily}
          availableFonts={availableFonts}
        />
        <FontSelector
          label="Body Font"
          value={editorAppearance.bodyFontFamily}
          onChange={setEditorBodyFontFamily}
          availableFonts={availableFonts}
        />
      </div>
    </div>
  );
};
