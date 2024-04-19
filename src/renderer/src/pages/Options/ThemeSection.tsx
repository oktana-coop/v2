import { SectionHeader } from './SectionHeader';
import { RadioGroup, Radio, RadioField } from '../../components/inputs/Radio';
import { Label } from '../../components/inputs/Fieldset';
import { useContext } from 'react';
import { themes, ThemeContext } from '../../personalization/theme';
import { MoonIcon, SunIcon } from '../../components/icons';

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
