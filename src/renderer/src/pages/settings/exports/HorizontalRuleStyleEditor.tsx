import { type HorizontalRuleStyle } from '../../../../../modules/personalization/export-templates';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';

type HorizontalRuleStyleEditorProps = {
  style: HorizontalRuleStyle;
  onChange: (style: HorizontalRuleStyle) => void;
};

export const HorizontalRuleStyleEditor = ({
  style,
  onChange,
}: HorizontalRuleStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 items-end gap-2">
      <Field className="text-left">
        <Label>Border Width (pt)</Label>
        <Input
          type="number"
          value={style.borderWidth}
          onChange={(e) =>
            onChange({ ...style, borderWidth: Number(e.target.value) })
          }
          min="0"
        />
      </Field>
      <Field className="text-left">
        <Label>Border Color</Label>
        <ColorInput
          value={style.borderColor}
          onChange={(borderColor) => onChange({ ...style, borderColor })}
        />
      </Field>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Field className="text-left">
        <Label>Space Before (pt)</Label>
        <Input
          type="number"
          value={style.spaceBefore}
          onChange={(e) =>
            onChange({ ...style, spaceBefore: Number(e.target.value) })
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
            onChange({ ...style, spaceAfter: Number(e.target.value) })
          }
          min="0"
        />
      </Field>
    </div>
  </div>
);
