import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { CheckIcon } from '../icons';
import { SplitButton } from './SplitButton';

const meta: Meta<typeof SplitButton> = {
  title: 'actions/SplitButton',
  component: SplitButton,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof SplitButton>>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    primaryLabel: (
      <>
        <CheckIcon />
        Commit
      </>
    ),
    onPrimaryClick: noop,
    primaryTooltip: 'Commit changes to this document and its referenced assets',
    toggleAriaLabel: 'More commit options',
    menuLabel: 'Other commit options',
    menuItems: [
      {
        label: 'Commit all project changes',
        description: 'Commit every modified file in the project',
        onClick: noop,
      },
    ],
  },
};

export const WithoutMenuLabel: Story = {
  args: {
    primaryLabel: 'Save changes',
    onPrimaryClick: noop,
    primaryTooltip: 'Save the current document',
    menuItems: [
      { label: 'Save and schedule', onClick: noop },
      { label: 'Save and publish', onClick: noop },
      { label: 'Export PDF', onClick: noop },
    ],
  },
};

export const Disabled: Story = {
  args: {
    primaryLabel: 'Commit',
    onPrimaryClick: noop,
    disabled: true,
    menuItems: [
      { label: 'First option', onClick: noop },
      { label: 'Second option', onClick: noop, disabled: true },
    ],
  },
};

export const NeutralColor: Story = {
  args: {
    primaryLabel: 'Save changes',
    onPrimaryClick: noop,
    color: 'neutral',
    menuLabel: 'More options',
    menuItems: [
      { label: 'Save and schedule', onClick: noop },
      { label: 'Save and publish', onClick: noop },
      { label: 'Export PDF', onClick: noop },
    ],
  },
};

export const NoMenuItemsRendersPlainButton: Story = {
  args: {
    primaryLabel: 'Commit',
    onPrimaryClick: noop,
    primaryTooltip: 'Commit changes',
    menuItems: [],
  },
};
