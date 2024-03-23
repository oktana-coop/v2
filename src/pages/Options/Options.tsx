import { SectionHeader } from './SectionHeader';
import { RadioGroup, Radio, RadioField } from '../../components/inputs/Radio';
import { Label } from '../../components/inputs/Fieldset';

export const Options = () => (
  <div className="container max-w-2xl mx-auto my-6">
    <SectionHeader />
    <RadioGroup name="theme" defaultValue="light">
      <RadioField>
        <Radio value="light" color="purple" />
        <Label>Light</Label>
      </RadioField>
      <RadioField>
        <Radio value="forbid" color="purple" />
        <Label>Dark</Label>
      </RadioField>
    </RadioGroup>
  </div>
);
