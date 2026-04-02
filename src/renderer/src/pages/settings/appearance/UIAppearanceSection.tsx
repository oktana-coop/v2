import { useContext } from 'react';

import { UIAppearanceContext } from '../../../../../modules/personalization/browser';
import { ToggleOffIcon } from '../../../components/icons';
import { FontSelector } from '../../shared/settings/FontSelector';
import { SectionHeader } from '../../shared/settings/SectionHeader';

export const UIAppearanceSection = () => {
  const { uiAppearance, setUIFontFamily, availableFonts } =
    useContext(UIAppearanceContext);

  return (
    <div>
      <SectionHeader icon={ToggleOffIcon} heading="User Interface" />
      <FontSelector
        label="User Interface Font"
        value={uiAppearance.fontFamily}
        onChange={setUIFontFamily}
        availableFonts={availableFonts}
      />
    </div>
  );
};
