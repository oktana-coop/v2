import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'actions/buttons/Primary',
  component: Button,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Button>>;

export const Primary: Story = {
  args: {
    color: 'purple',
    children: 'Primary Button',
  },
};
