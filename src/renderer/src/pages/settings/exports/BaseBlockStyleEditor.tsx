import { useContext } from 'react';

import {
  type LetterSpacing,
  letterSpacings,
  type LineHeight,
  lineHeights,
  type TextAlignment,
  textAlignments,
} from '../../../../../modules/personalization';
import {
  type FontWeight,
  fontWeightOptions,
} from '../../../../../modules/personalization/appearance/editor';
import { EditorAppearanceContext } from '../../../../../modules/personalization/browser';
import { type BaseBlockStyle } from '../../../../../modules/personalization/export-templates';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  FontSpacingIcon,
  LineHeightIcon,
} from '../../../components/icons';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { SegmentedControl } from '../../../components/inputs/SegmentedControl';
import { FontSelector } from '../../shared/settings/FontSelector';

type BaseBlockStyleEditorProps = {
  style: BaseBlockStyle;
  onChange: (style: BaseBlockStyle) => void;
};

const lineHeightLabels: Record<LineHeight, string> = {
  auto: 'Auto',
  '1': '1',
  '1.15': '1.15',
  '1.25': '1.25',
  '1.5': '1.5',
  '1.75': '1.75',
  '2': '2',
};

const lineHeightOptions = lineHeights.map((value) => ({
  value,
  label: lineHeightLabels[value],
}));

const letterSpacingLabels: Record<LetterSpacing, string> = {
  auto: 'Auto',
  '0': '0',
  '0.5': '0.5',
  '1': '1',
  '1.5': '1.5',
  '2': '2',
};

const letterSpacingOptions = letterSpacings.map((value) => ({
  value,
  label: letterSpacingLabels[value],
}));

const alignmentIcons: Record<TextAlignment, React.ReactNode> = {
  left: <AlignLeftIcon size={20} />,
  center: <AlignCenterIcon size={20} />,
  right: <AlignRightIcon size={20} />,
  justify: <AlignJustifyIcon size={20} />,
};

const alignmentOptions = textAlignments.map((value) => ({
  value,
  label: alignmentIcons[value],
}));

const update = (
  style: BaseBlockStyle,
  patch: Partial<BaseBlockStyle>
): BaseBlockStyle => ({ ...style, ...patch });

export const BaseBlockStyleEditor = ({
  style,
  onChange,
}: BaseBlockStyleEditorProps) => {
  const { availableFonts } = useContext(EditorAppearanceContext);

  return (
    <div className="flex flex-col gap-3">
      <FontSelector
        value={style.fontFamily}
        onChange={(fontFamily) => onChange(update(style, { fontFamily }))}
        availableFonts={availableFonts}
      />
      <div className="grid grid-cols-2 items-center gap-2">
        <Listbox
          aria-label="Weight"
          value={style.fontWeight}
          onChange={(fontWeight: FontWeight) =>
            onChange(update(style, { fontWeight }))
          }
          modal={false}
        >
          {fontWeightOptions.map(({ value, label }) => (
            <ListboxOption key={value} value={value}>
              <ListboxLabel style={{ fontWeight: value }}>{label}</ListboxLabel>
            </ListboxOption>
          ))}
        </Listbox>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Size"
            type="number"
            value={style.fontSize}
            onChange={(e) =>
              onChange(update(style, { fontSize: Number(e.target.value) }))
            }
            min="1"
          />
          <ColorInput
            aria-label="Color"
            value={style.color}
            onChange={(color) => onChange(update(style, { color }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Listbox
          aria-label="Line Height"
          icon={<LineHeightIcon size={20} />}
          value={style.lineHeight}
          onChange={(lineHeight: LineHeight) =>
            onChange(update(style, { lineHeight }))
          }
          modal={false}
        >
          {lineHeightOptions.map(({ value, label }) => (
            <ListboxOption key={value} value={value}>
              <ListboxLabel>{label}</ListboxLabel>
            </ListboxOption>
          ))}
        </Listbox>
        <Listbox
          aria-label="Letter Spacing"
          icon={<FontSpacingIcon size={20} />}
          value={style.letterSpacing}
          onChange={(letterSpacing: LetterSpacing) =>
            onChange(update(style, { letterSpacing }))
          }
          modal={false}
        >
          {letterSpacingOptions.map(({ value, label }) => (
            <ListboxOption key={value} value={value}>
              <ListboxLabel>{label}</ListboxLabel>
            </ListboxOption>
          ))}
        </Listbox>
      </div>
      <div className="flex">
        <SegmentedControl
          options={alignmentOptions}
          value={style.textAlignment}
          onChange={(textAlignment) =>
            onChange(update(style, { textAlignment }))
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field className="text-left">
          <Label>Space Before (pt)</Label>
          <Input
            type="number"
            value={style.spaceBefore}
            onChange={(e) =>
              onChange(update(style, { spaceBefore: Number(e.target.value) }))
            }
            min="0"
          />
        </Field>
        <Field className="text-left">
          <Label>Space After (pt)</Label>
          <Input
            type="number"
            value={style.spaceAfter}
            onChange={(e) =>
              onChange(update(style, { spaceAfter: Number(e.target.value) }))
            }
            min="0"
          />
        </Field>
      </div>
    </div>
  );
};
