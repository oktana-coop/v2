import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { CommandPalette } from './CommandPalette';

const meta: Meta<typeof CommandPalette> = {
  title: 'dialogs/Command Palette',
  component: CommandPalette,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof CommandPalette>>;

export const Primary: Story = {};

export default meta;
