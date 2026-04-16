import {
  type LinkStyle,
  type TextDecoration,
  textDecorations,
} from '../../../../../modules/personalization/export-templates';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { SegmentedControl } from '../../../components/inputs/SegmentedControl';

type LinkStyleEditorProps = {
  style: LinkStyle;
  onChange: (style: LinkStyle) => void;
};

const textDecorationLabels: Record<TextDecoration, string> = {
  underline: 'Underline',
  none: 'None',
};

const textDecorationOptions = textDecorations.map((value) => ({
  value,
  label: textDecorationLabels[value],
}));

export const LinkStyleEditor = ({ style, onChange }: LinkStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <Field className="text-left">
      <Label>Color</Label>
      <ColorInput
        value={style.color}
        onChange={(color) => onChange({ ...style, color })}
      />
    </Field>
    <Field className="text-left">
      <Label>Text Decoration</Label>
      <div className="flex">
        <SegmentedControl
          options={textDecorationOptions}
          value={style.textDecoration}
          onChange={(textDecoration: TextDecoration) =>
            onChange({ ...style, textDecoration })
          }
        />
      </div>
    </Field>
  </div>
);
