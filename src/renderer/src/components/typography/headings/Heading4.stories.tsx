import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { Heading4 } from './Heading4';

const meta: Meta<typeof Heading4> = {
  title: 'typography/headings/Heading4',
  component: Heading4,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Heading4>>;

export const Default: Story = {
  render: () => <Heading4>Heading 4</Heading4>,
};
