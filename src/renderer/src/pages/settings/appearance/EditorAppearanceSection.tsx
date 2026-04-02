import { useContext } from 'react';

import {
  type FontWeight,
  fontWeightOptions,
  type HeadingTextSize,
  headingTextSizeOptions,
} from '../../../../../modules/personalization/appearance/editor';
import { EditorAppearanceContext } from '../../../../../modules/personalization/browser';
import { PenIcon } from '../../../components/icons';
import { Field, Label } from '../../../components/inputs/Fieldset';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { FontSelector } from '../../shared/settings/FontSelector';
import { SectionHeader } from '../../shared/settings/SectionHeader';

export const EditorAppearanceSection = () => {
  const {
    editorAppearance,
    setEditorHeadingFontFamily,
    setEditorHeadingFontWeight,
    setEditorHeadingTextSize,
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
        <Field className="text-left">
          <Label>Heading Font Weight</Label>
          <Listbox
            value={editorAppearance.headingFontWeight}
            onChange={(value: FontWeight) => setEditorHeadingFontWeight(value)}
            modal={false}
          >
            {fontWeightOptions.map(({ value, label }) => (
              <ListboxOption key={value} value={value}>
                <ListboxLabel style={{ fontWeight: value }}>
                  {label}
                </ListboxLabel>
              </ListboxOption>
            ))}
          </Listbox>
        </Field>
        <Field className="text-left">
          <Label>Heading Text Size</Label>
          <Listbox
            value={editorAppearance.headingTextSize}
            onChange={(value: HeadingTextSize) =>
              setEditorHeadingTextSize(value)
            }
            modal={false}
          >
            {headingTextSizeOptions.map(({ value, label }) => (
              <ListboxOption key={value} value={value}>
                <ListboxLabel>{label}</ListboxLabel>
              </ListboxOption>
            ))}
          </Listbox>
        </Field>
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
