import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { SunIcon } from '../../../components/icons';
import { SectionHeader } from './SectionHeader';

const meta: Meta<typeof SectionHeader> = {
  title: 'pages/options/SectionHeader',
  component: SectionHeader,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof SectionHeader>>;

export const WithIcon: Story = {
  args: {
    icon: SunIcon,
    heading: 'Theme',
  },
};

export const HeadingOnly: Story = {
  args: {
    heading: 'Heading',
  },
};

export default meta;
