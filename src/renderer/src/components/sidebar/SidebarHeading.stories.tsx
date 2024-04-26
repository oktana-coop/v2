import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { FolderIcon } from '../../components/icons';
import { SidebarHeading } from './SidebarHeading';

const meta: Meta<typeof SidebarHeading> = {
  title: 'sidebar/Heading',
  component: SidebarHeading,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof SidebarHeading>>;

export const WithIcon: Story = {
  args: {
    icon: FolderIcon,
    text: 'File Explorer',
  },
};

export const HeadingOnly: Story = {
  args: {
    text: 'File Explorer',
  },
};

export default meta;
