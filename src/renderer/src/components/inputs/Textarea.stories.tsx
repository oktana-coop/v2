import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Field, Label } from './Fieldset';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'inputs/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Textarea>>;

export const Default: Story = {
  render: () => <Textarea aria-label="Message" name="message" />,
};

export const WithLabel: Story = {
  render: () => (
    <Field>
      <Label>Message</Label>
      <Textarea aria-label="Message" name="message" />
    </Field>
  ),
};

export default meta;
