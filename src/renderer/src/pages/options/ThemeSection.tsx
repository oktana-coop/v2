import { useContext } from 'react';

import {
  ThemeContext,
  themes,
} from '../../../../modules/personalization/browser';
import { MoonIcon, SunIcon } from '../../components/icons';
import { Label } from '../../components/inputs/Fieldset';
import { Radio, RadioField, RadioGroup } from '../../components/inputs/Radio';
import { SectionHeader } from '../shared/settings/SectionHeader';

export const ThemeSection = () => {
  const { theme, resolvedTheme, setTheme } = useContext(ThemeContext);

  return (
    <div>
      <SectionHeader
        icon={resolvedTheme === themes.dark ? MoonIcon : SunIcon}
        heading="Theme"
      />
      <RadioGroup name="theme" value={theme} onChange={setTheme}>
        <RadioField>
          <Radio value={themes.system} color="purple" />
          <Label>System</Label>
        </RadioField>
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
