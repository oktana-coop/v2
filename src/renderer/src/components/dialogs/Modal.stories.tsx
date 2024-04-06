import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { Button } from '../actions/Button';

import { CheckIcon } from '../icons';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'dialogs/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Modal>>;

export const Simple: Story = {
  args: {
    title: 'A simple modal',
    description: 'With some optional description that can be added here',
    isOpen: true,
  },
};

export const SimpleWithButtons: Story = {
  render: () => (
    <Modal
      title="Some fancy title"
      secondaryButton={<Button>Cancel</Button>}
      primaryButton={<Button color="purple">Save</Button>}
      isOpen={true}
    />
  ),
};

export const SimpleWithButtonsAndBody: Story = {
  render: () => (
    <Modal
      title="Commit changes"
      description="Are you sure you want to commit these changes?"
      secondaryButton={<Button>Cancel</Button>}
      isOpen={true}
      primaryButton={
        <Button variant="solid" color="purple">
          <CheckIcon />
          Commit
        </Button>
      }
    >
      <textarea></textarea>
    </Modal>
  ),
};
