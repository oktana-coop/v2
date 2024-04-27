import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Field, Label } from './Fieldset';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'inputs/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Input>>;

export const Default: Story = {
  render: () => (
    <Field>
      <Label>Name</Label>
      <Input name="firstName" />
    </Field>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Field disabled>
      <Label>Label</Label>
      <Input name="firstName" />
    </Field>
  ),
};

export const Error: Story = {
  render: () => (
    <Field>
      <Label>Label</Label>
      <Input name="firstName" invalid />
    </Field>
  ),
};

export default meta;
