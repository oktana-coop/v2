import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import {
  reactRouterOutlets,
  reactRouterParameters,
  withRouter,
} from 'storybook-addon-remix-react-router';

import { Breadcrumb } from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  title: 'navigation/Breadcrumb',
  component: Breadcrumb,
  decorators: [withRouter],
  parameters: {
    layout: 'centered',
    reactRouter: reactRouterParameters({
      routing: reactRouterOutlets([
        { path: '/options', element: <div /> },
        { path: '/options/appearance', element: <div /> },
      ]),
    }),
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof Breadcrumb>>;

export const SingleSegment: Story = {
  args: {
    segments: [{ label: 'Settings' }],
  },
};

export const TwoSegments: Story = {
  args: {
    segments: [{ label: 'Settings', href: '/options' }, { label: 'General' }],
  },
};

export const ThreeSegments: Story = {
  args: {
    segments: [
      { label: 'Settings', href: '/options' },
      { label: 'Appearance', href: '/options/appearance' },
      { label: 'Theme' },
    ],
  },
};
