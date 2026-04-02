import { type AvailableFonts } from '../../../../../modules/personalization/browser';
import { Field, Label } from '../../../components/inputs/Fieldset';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';

type FontSelectorProps = {
  label: string;
  value: string;
  onChange: (fontFamily: string) => void;
  availableFonts: AvailableFonts;
};

export const FontSelector = ({
  label,
  value,
  onChange,
  availableFonts,
}: FontSelectorProps) => (
  <Field className="text-left">
    <Label>{label}</Label>
    <Listbox value={value} onChange={onChange} modal={false}>
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
);
