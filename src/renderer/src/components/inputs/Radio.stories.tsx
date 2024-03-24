import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { RadioGroup, Radio, RadioField } from './Radio';
import { Label } from './Fieldset';

const meta: Meta<typeof Radio> = {
  title: 'inputs/Radio',
  component: Radio,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Radio>>;

export const Default: Story = {
  render: () => (
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
  ),
};

export default meta;
