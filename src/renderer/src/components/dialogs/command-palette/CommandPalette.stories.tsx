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

const myRecentDocuments = [
  {
    id: '1',
    title: 'Flow collaboration workflow',
    onDocumentSelection: () =>
      console.log('Flow collaboration workflow clicked'),
  },
  {
    id: '2',
    title: '🧠 My new second brain',
    onDocumentSelection: () => console.log('🧠 My second brain clicked'),
  },
];

const quickActions = [
  {
    name: 'Add new file...',
    shortcut: 'N',
    onActionSelection: () => console.log('Add new file... selected'),
  },
  {
    name: 'Add new folder...',
    shortcut: 'F',
    onActionSelection: () => console.log('Add new folder... selected'),
  },
  {
    name: 'Add hashtag...',
    shortcut: 'H',
    onActionSelection: () => {
      console.log('Add hashtag... selected');
    },
  },
  {
    name: 'Add label...',
    shortcut: 'L',
    onActionSelection: () => {
      console.log('Add label... selected');
    },
  },
];

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('Closed');
    },
    documentsGroupTitle: 'Recently opened documents',
    documents: myRecentDocuments,
    actions: quickActions,
  },
};

export const NoDocuments: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('Closed');
    },
  },
};

export default meta;
