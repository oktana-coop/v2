import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Logo } from './Logo';

const meta: Meta<typeof Logo> = {
  title: 'brand/Logo',
  component: Logo,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Logo>>;

export const LightBackground: Story = {
  args: {
    size: 56,
  },
};

export default meta;
