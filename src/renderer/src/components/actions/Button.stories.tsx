import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { CheckIcon } from '../icons';
import { Button } from './Button';
import { IconButton as IconButtonComponent } from './IconButton';

const meta: Meta<typeof Button> = {
  title: 'actions/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Button>>;

export const Solid: Story = {
  args: {
    color: 'purple',
    children: 'Solid Button',
  },
};

export const SolidWithIcon: Story = {
  render: () => (
    <Button variant="solid" color="purple">
      <CheckIcon />
      Solid Button
    </Button>
  ),
};

export const Plain: Story = {
  args: {
    variant: 'plain',
    children: 'Plain Button',
  },
};

export const PlainWithIcon: Story = {
  render: () => (
    <Button variant="plain">
      <CheckIcon />
      Plain Button
    </Button>
  ),
};

export const PlainWithIconAndColor: Story = {
  render: () => (
    <Button variant="plain" color="purple">
      <CheckIcon />
      Plain Button
    </Button>
  ),
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Disabled: Story = {
  args: {
    color: 'purple',
    disabled: true,
    children: 'Disabled Button',
  },
};

export const IconButton: Story = {
  render: () => <IconButtonComponent icon={<CheckIcon />} color="purple" />,
};

export const IconButtonWithTooltip: Story = {
  render: () => (
    <IconButtonComponent
      icon={<CheckIcon />}
      color="purple"
      tooltip="Tooltip"
    />
  ),
};

export const VariantsColorsAndSizes: Story = {
  render: () => {
    const variants = ['solid', 'outline', 'plain'] as const;
    const colors = [undefined, 'purple', 'red'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;

    return (
      <div className="grid gap-10">
        {variants.map((variant) => (
          <div key={variant} className="space-y-4">
            <strong className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
              {variant}
            </strong>

            <div className="space-y-3">
              {sizes.map((size) => (
                <div key={size} className="flex items-center gap-4">
                  <div className="w-10 text-xs text-gray-600 dark:text-gray-400">
                    {size}
                  </div>

                  <div className="flex gap-4">
                    {colors.map((color) => (
                      <Button
                        key={`${variant}-${size}-${color ?? 'default'}`}
                        variant={variant}
                        color={color}
                        size={size}
                      >
                        {color ?? 'default'}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
