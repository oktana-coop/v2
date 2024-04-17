import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Timeliner } from './Timeliner';

const meta: Meta<typeof Timeliner> = {
  title: 'icons/Timeliner',
  component: Timeliner,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Timeliner>>;

export const Solid: Story = {
  args: {
    color: 'purple',
    size: 100,
  },
};

export const TimelinerStory: Story = {
  render: () => (
    <div
      className="flex flex-row items-center"
      style={{
        width: 500,
        backgroundColor: 'white',
      }}
    >
      <div
        className="flex flex-row items-center"
        style={{
          width: 50,
          height: '100%',
          backgroundColor: 'white',
        }}
      >
        <Timeliner color="purple" />
      </div>
      Some message
    </div>
  ),
};
