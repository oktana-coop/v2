import { type CodeBlockStyle } from '../../../../../modules/personalization/export-templates';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';

type CodeBlockStyleEditorProps = {
  style: CodeBlockStyle;
  onChange: (style: CodeBlockStyle) => void;
};

export const CodeBlockStyleEditor = ({
  style,
  onChange,
}: CodeBlockStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <BaseBlockStyleEditor
      style={style}
      onChange={(base) => onChange({ ...style, ...base })}
    />
    <div className="grid grid-cols-2 items-end gap-2">
      <Field className="text-left">
        <Label>Background</Label>
        <ColorInput
          value={style.backgroundColor}
          onChange={(backgroundColor) =>
            onChange({ ...style, backgroundColor })
          }
        />
      </Field>
      <Field className="text-left">
        <Label>Padding (pt)</Label>
        <Input
          type="number"
          value={style.padding}
          onChange={(e) =>
            onChange({ ...style, padding: Number(e.target.value) })
          }
          min="0"
        />
      </Field>
    </div>
  </div>
);
