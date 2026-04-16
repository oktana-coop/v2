import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from '../icons';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'inputs/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<typeof SegmentedControl>;

const alignmentOptions = [
  { value: 'left', label: <AlignLeftIcon size={20} /> },
  { value: 'center', label: <AlignCenterIcon size={20} /> },
  { value: 'right', label: <AlignRightIcon size={20} /> },
  { value: 'justify', label: <AlignJustifyIcon size={20} /> },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('left');
    return (
      <SegmentedControl
        options={alignmentOptions}
        value={value}
        onChange={setValue}
      />
    );
  },
};

const sizeOptions = [
  { value: 'sm', label: <span className="px-1.5">Small</span> },
  { value: 'md', label: <span className="px-1.5">Medium</span> },
  { value: 'lg', label: <span className="px-1.5">Large</span> },
  { value: 'xl', label: <span className="px-1.5">Extra Large</span> },
];

export const WithText: Story = {
  render: () => {
    const [value, setValue] = useState('md');
    return (
      <SegmentedControl
        options={sizeOptions}
        value={value}
        onChange={setValue}
      />
    );
  },
};

export default meta;
