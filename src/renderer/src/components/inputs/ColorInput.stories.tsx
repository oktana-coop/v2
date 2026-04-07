import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { ColorInput } from './ColorInput';

const meta: Meta<typeof ColorInput> = {
  title: 'inputs/ColorInput',
  component: ColorInput,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<typeof ColorInput>;

export const Default: Story = {
  render: () => {
    const [color, setColor] = useState('#000000');
    return <ColorInput value={color} onChange={setColor} />;
  },
};

export default meta;
