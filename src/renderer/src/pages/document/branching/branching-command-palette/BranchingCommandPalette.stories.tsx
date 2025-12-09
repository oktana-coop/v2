import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { BranchingCommandPalette, BranchingCommandPaletteProps } from './index';

const meta: Meta<typeof BranchingCommandPalette> = {
  title: 'dialogs/Branching Command Palette',
  component: BranchingCommandPalette,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof BranchingCommandPalette>>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('Closed');
    },
    currentBranch: 'polishing' as BranchingCommandPaletteProps['currentBranch'],
  },
};

export default meta;
