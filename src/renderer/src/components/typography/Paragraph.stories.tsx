import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Paragraph } from './Paragraph';

const meta: Meta<typeof Paragraph> = {
  title: 'typography/Paragraph',
  component: Paragraph,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Paragraph>>;

export const Default: Story = {
  render: () => (
    <Paragraph>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
      tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
      veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
      commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
      velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
      cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
      est laborum.
    </Paragraph>
  ),
};
