import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { SectionHeader } from './SectionHeader';

const meta: Meta<typeof SectionHeader> = {
  title: 'pages/options/SectionHeader',
  component: SectionHeader,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof SectionHeader>>;

export const Default: Story = {
  render: () => <SectionHeader />,
};

export default meta;
