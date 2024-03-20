import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Button } from './Button';
import { IconButton as IconButtonComponent } from './IconButton';
import { CheckIcon } from '../icons';

const meta: Meta<typeof Button> = {
  title: 'actions/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Button>>;

export const Solid: Story = {
  args: {
    color: 'purple',
    children: 'Solid Button',
  },
};

export const SolidWithIcon: Story = {
  render: () => (
    <Button variant="solid" color="purple">
      <CheckIcon color="var(--btn-icon)" />
      Solid Button
    </Button>
  ),
};

export const Plain: Story = {
  args: {
    variant: 'plain',
    children: 'Plain Button',
  },
};

export const PlainWithIcon: Story = {
  render: () => (
    <Button variant="plain">
      <CheckIcon color="var(--btn-icon)" />
      Plain Button
    </Button>
  ),
};

export const PlainWithIconAndColor: Story = {
  render: () => (
    <Button variant="plain" color="purple">
      <CheckIcon color="var(--btn-icon)" />
      Plain Button
    </Button>
  ),
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Disabled: Story = {
  args: {
    color: 'purple',
    disabled: true,
    children: 'Disabled Button',
  },
};

export const IconButton: Story = {
  render: () => (
    <IconButtonComponent
      icon={<CheckIcon color="var(--btn-icon)" />}
      color="purple"
    />
  ),
};
