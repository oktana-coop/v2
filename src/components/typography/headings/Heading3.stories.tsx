import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Heading3 } from './Heading3';

const meta: Meta<typeof Heading3> = {
  title: 'typography/headings/Heading3',
  component: Heading3,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Heading3>>;

export const Default: Story = {
  render: () => <Heading3>Heading 3</Heading3>,
};
