import {
  type BulletListStyle,
  type BulletListStyleType,
  bulletListStyleTypes,
} from '../../../../../modules/personalization/export-templates';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';

type BulletListStyleEditorProps = {
  style: BulletListStyle;
  onChange: (style: BulletListStyle) => void;
};

const bulletListStyleTypeLabels: Record<BulletListStyleType, string> = {
  disc: 'Disc',
  circle: 'Circle',
  square: 'Square',
};

const listStyleOptions = bulletListStyleTypes.map((value) => ({
  value,
  label: bulletListStyleTypeLabels[value],
}));

export const BulletListStyleEditor = ({
  style,
  onChange,
}: BulletListStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <Field className="text-left">
      <Label>Bullet Style</Label>
      <Listbox
        value={style.listStyleType}
        onChange={(listStyleType: BulletListStyleType) =>
          onChange({ ...style, listStyleType })
        }
        modal={false}
      >
        {listStyleOptions.map(({ value, label }) => (
          <ListboxOption key={value} value={value}>
            <ListboxLabel>{label}</ListboxLabel>
          </ListboxOption>
        ))}
      </Listbox>
    </Field>
    <Field className="text-left">
      <Label>Indentation (pt)</Label>
      <Input
        type="number"
        value={style.indentation}
        onChange={(e) =>
          onChange({ ...style, indentation: Number(e.target.value) })
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
