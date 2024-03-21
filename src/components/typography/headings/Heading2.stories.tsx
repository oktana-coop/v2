import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Heading2 } from './Heading2';

const meta: Meta<typeof Heading2> = {
  title: 'typography/headings/Heading2',
  component: Heading2,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Heading2>>;

export const Default: Story = {
  render: () => <Heading2>Heading 2</Heading2>,
};
