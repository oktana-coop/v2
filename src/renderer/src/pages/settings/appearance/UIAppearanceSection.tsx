import { useContext } from 'react';

import { UIAppearanceContext } from '../../../../../modules/personalization/browser';
import { OptionsIcon } from '../../../components/icons';
import { SectionHeader } from '../../shared/settings/SectionHeader';
import { FontSelector } from '../../shared/settings/FontSelector';

export const UIAppearanceSection = () => {
  const { uiAppearance, setUIFontFamily, availableFonts } =
    useContext(UIAppearanceContext);

  return (
    <div>
      <SectionHeader icon={OptionsIcon} heading="User Interface" />
      <FontSelector
        label="User Interface Font"
        value={uiAppearance.fontFamily}
        onChange={setUIFontFamily}
        availableFonts={availableFonts}
      />
    </div>
  );
};
