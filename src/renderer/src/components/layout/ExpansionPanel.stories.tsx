import type { Meta, StoryObj } from '@storybook/react';

import { ExpansionPanel } from './ExpansionPanel';

const meta: Meta<typeof ExpansionPanel> = {
  title: 'layout/ExpansionPanel',
  component: ExpansionPanel,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

type Story = StoryObj<typeof ExpansionPanel>;

export const Default: Story = {
  args: {
    title: 'Section Title',
    children: (
      <p className="text-sm text-zinc-500">Expandable content goes here.</p>
    ),
  },
};

export const DefaultOpen: Story = {
  args: {
    title: 'Open by Default',
    defaultOpen: true,
    children: (
      <p className="text-sm text-zinc-500">This section starts expanded.</p>
    ),
  },
};

export const Multiple: Story = {
  render: () => (
    <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-700">
      <ExpansionPanel title="Paragraph">
        <p className="text-sm text-zinc-500">Paragraph settings</p>
      </ExpansionPanel>
      <ExpansionPanel title="Heading 1">
        <p className="text-sm text-zinc-500">Heading 1 settings</p>
      </ExpansionPanel>
      <ExpansionPanel title="Heading 2">
        <p className="text-sm text-zinc-500">Heading 2 settings</p>
      </ExpansionPanel>
    </div>
  ),
};

export default meta;
