import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Heading1 } from './Heading1';

const meta: Meta<typeof Heading1> = {
  title: 'typography/headings/Heading1',
  component: Heading1,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Heading1>>;

export const Default: Story = {
  render: () => <Heading1>Heading1</Heading1>,
};
