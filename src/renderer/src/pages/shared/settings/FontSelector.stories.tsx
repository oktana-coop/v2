import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { FontSelector } from './FontSelector';

const meta: Meta<typeof FontSelector> = {
  title: 'pages/settings/FontSelector',
  component: FontSelector,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof FontSelector>>;

const bundledFonts = ['Noto Sans', 'Montserrat'] as const;

export const BundledOnly: Story = {
  args: {
    label: 'Body Font',
    value: 'Noto Sans',
    availableFonts: { bundled: bundledFonts, system: [] },
  },
};

export const WithSystemFonts: Story = {
  args: {
    label: 'Heading Font',
    value: 'Noto Sans',
    availableFonts: {
      bundled: bundledFonts,
      system: ['Arial', 'Georgia', 'Helvetica', 'Times New Roman'],
    },
  },
};

export default meta;
