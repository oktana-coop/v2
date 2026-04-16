import { type ParagraphStyle } from '../../../../../modules/personalization/export-templates';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';

type ParagraphStyleEditorProps = {
  style: ParagraphStyle;
  onChange: (style: ParagraphStyle) => void;
};

export const ParagraphStyleEditor = ({
  style,
  onChange,
}: ParagraphStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <BaseBlockStyleEditor
      style={style}
      onChange={(base) => onChange({ ...style, ...base })}
    />
    <Field className="text-left">
      <Label>First Line Indent (pt)</Label>
      <Input
        type="number"
        value={style.firstLineIndent}
        onChange={(e) =>
          onChange({ ...style, firstLineIndent: Number(e.target.value) })
        }
        min="0"
      />
    </Field>
  </div>
);
