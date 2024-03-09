import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Button } from './Button';

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

export const Plain: Story = {
  args: {
    plain: true,
    children: 'Plain Button',
  },
};

export const Outline: Story = {
  args: {
    outline: true,
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
