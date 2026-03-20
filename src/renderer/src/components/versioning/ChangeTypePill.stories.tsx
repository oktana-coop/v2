import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { documentChangeTypes } from '../../../../modules/infrastructure/version-control';
import { ChangeTypePill } from './ChangeTypePill';

const meta: Meta<typeof ChangeTypePill> = {
  title: 'versioning/ChangeTypePill',
  component: ChangeTypePill,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof ChangeTypePill>>;

export const Modified: Story = {
  args: { changeType: documentChangeTypes.MODIFIED },
};

export const Added: Story = {
  args: { changeType: documentChangeTypes.ADDED },
};

export const Deleted: Story = {
  args: { changeType: documentChangeTypes.DELETED },
};

export const Renamed: Story = {
  args: { changeType: documentChangeTypes.RENAMED },
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <ChangeTypePill changeType={documentChangeTypes.MODIFIED} />
      <ChangeTypePill changeType={documentChangeTypes.ADDED} />
      <ChangeTypePill changeType={documentChangeTypes.DELETED} />
      <ChangeTypePill changeType={documentChangeTypes.RENAMED} />
    </div>
  ),
};
