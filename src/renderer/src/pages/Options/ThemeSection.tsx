import { useContext } from 'react';

import { MoonIcon, SunIcon } from '../../components/icons';
import { Label } from '../../components/inputs/Fieldset';
import { Radio, RadioField, RadioGroup } from '../../components/inputs/Radio';
import { ThemeContext, themes } from '../../personalization/theme';
import { SectionHeader } from './SectionHeader';

export const ThemeSection = () => {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <div>
      <SectionHeader
        icon={theme === themes.dark ? MoonIcon : SunIcon}
        heading="Theme"
      />
      <RadioGroup name="theme" value={theme} onChange={setTheme}>
        <RadioField>
          <Radio value={themes.light} color="purple" />
          <Label>Light</Label>
        </RadioField>
        <RadioField>
          <Radio value={themes.dark} color="purple" />
          <Label>Dark</Label>
        </RadioField>
      </RadioGroup>
    </div>
  );
};
