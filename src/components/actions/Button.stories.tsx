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
