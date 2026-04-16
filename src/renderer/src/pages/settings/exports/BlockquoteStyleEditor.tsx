import { type BlockquoteStyle } from '../../../../../modules/personalization/export-templates';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';

type BlockquoteStyleEditorProps = {
  style: BlockquoteStyle;
  onChange: (style: BlockquoteStyle) => void;
};

export const BlockquoteStyleEditor = ({
  style,
  onChange,
}: BlockquoteStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 items-end gap-2">
      <Field className="text-left">
        <Label>Border Width (pt)</Label>
        <Input
          type="number"
          value={style.borderLeftWidth}
          onChange={(e) =>
            onChange({ ...style, borderLeftWidth: Number(e.target.value) })
          }
          min="0"
        />
      </Field>
      <Field className="text-left">
        <Label>Border Color</Label>
        <ColorInput
          value={style.borderLeftColor}
          onChange={(borderLeftColor) =>
            onChange({ ...style, borderLeftColor })
          }
        />
      </Field>
    </div>
    <Field className="text-left">
      <Label>Left Margin (pt)</Label>
      <Input
        type="number"
        value={style.marginLeft}
        onChange={(e) =>
          onChange({ ...style, marginLeft: Number(e.target.value) })
        }
        min="0"
      />
    </Field>
    <BaseBlockStyleEditor
      style={style}
      onChange={(base) => onChange({ ...style, ...base })}
    />
  </div>
);
