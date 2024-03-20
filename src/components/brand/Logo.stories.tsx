import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { themes } from '../../constants/theme';
import { Logo } from './Logo';

const meta: Meta<typeof Logo> = {
  title: 'brand/Logo',
  component: Logo,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Logo>>;

export const LightTheme: Story = {
  args: {
    size: 56,
  },
};

export const DarkTheme: Story = {
  args: {
    size: 56,
    theme: themes.dark,
  },
};

export default meta;
