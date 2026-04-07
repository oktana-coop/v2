import {
  type OrderedListStyle,
  type OrderedListStyleType,
  orderedListStyleTypes,
} from '../../../../../modules/personalization/export-templates';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';

type OrderedListStyleEditorProps = {
  style: OrderedListStyle;
  onChange: (style: OrderedListStyle) => void;
};

const orderedListStyleTypeLabels: Record<OrderedListStyleType, string> = {
  decimal: 'Decimal',
  'lower-alpha': 'Lower Alpha',
  'lower-roman': 'Lower Roman',
  'upper-alpha': 'Upper Alpha',
  'upper-roman': 'Upper Roman',
};

const listStyleOptions = orderedListStyleTypes.map((value) => ({
  value,
  label: orderedListStyleTypeLabels[value],
}));

export const OrderedListStyleEditor = ({
  style,
  onChange,
}: OrderedListStyleEditorProps) => (
  <div className="flex flex-col gap-3">
    <Field className="text-left">
      <Label>Number Style</Label>
      <Listbox
        value={style.listStyleType}
        onChange={(listStyleType: OrderedListStyleType) =>
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
