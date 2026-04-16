import { useContext } from 'react';

import { EditorAppearanceContext } from '../../../../../modules/personalization/browser';
import { type InlineCodeStyle } from '../../../../../modules/personalization/export-templates';
import { ColorInput } from '../../../components/inputs/ColorInput';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import { FontSelector } from '../../shared/settings/FontSelector';

type InlineCodeStyleEditorProps = {
  style: InlineCodeStyle;
  onChange: (style: InlineCodeStyle) => void;
};

export const InlineCodeStyleEditor = ({
  style,
  onChange,
}: InlineCodeStyleEditorProps) => {
  const { availableFonts } = useContext(EditorAppearanceContext);

  return (
    <div className="flex flex-col gap-3">
      <FontSelector
        value={style.fontFamily}
        onChange={(fontFamily) => onChange({ ...style, fontFamily })}
        availableFonts={availableFonts}
      />
      <div className="grid grid-cols-2 items-end gap-2">
        <Field className="text-left">
          <Label>Size (pt)</Label>
          <Input
            type="number"
            value={style.fontSize}
            onChange={(e) =>
              onChange({ ...style, fontSize: Number(e.target.value) })
            }
            min="1"
          />
        </Field>
        <Field className="text-left">
          <Label>Color</Label>
          <ColorInput
            value={style.color}
            onChange={(color) => onChange({ ...style, color })}
          />
        </Field>
      </div>
      <Field className="text-left">
        <Label>Background</Label>
        <ColorInput
          value={style.backgroundColor}
          onChange={(backgroundColor) =>
            onChange({ ...style, backgroundColor })
          }
        />
      </Field>
    </div>
  );
};
