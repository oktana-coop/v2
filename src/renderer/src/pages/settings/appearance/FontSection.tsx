import { useContext } from 'react';

import { UIAppearanceContext } from '../../../../../modules/personalization/browser';
import { OptionsIcon } from '../../../components/icons';
import { Field, Label } from '../../../components/inputs/Fieldset';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { SectionHeader } from '../../shared/settings/SectionHeader';

export const FontSection = () => {
  const { uiAppearance, setUIFontFamily, availableFonts } =
    useContext(UIAppearanceContext);

  return (
    <div>
      <SectionHeader icon={OptionsIcon} heading="User Interface" />
      <Field className="text-left">
        <Label>User Interface Font</Label>
        <Listbox
          value={uiAppearance.fontFamily}
          onChange={setUIFontFamily}
          modal={false}
        >
          {availableFonts.bundled.map((font) => (
            <ListboxOption key={font} value={font}>
              <ListboxLabel style={{ fontFamily: font }}>{font}</ListboxLabel>
            </ListboxOption>
          ))}
          {availableFonts.system.map((font) => (
            <ListboxOption key={font} value={font}>
              <ListboxLabel style={{ fontFamily: font }}>{font}</ListboxLabel>
            </ListboxOption>
          ))}
        </Listbox>
      </Field>
    </div>
  );
};
