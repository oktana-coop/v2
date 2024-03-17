import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import {
  withRouter,
  reactRouterParameters,
  reactRouterOutlets,
} from 'storybook-addon-remix-react-router';

import { NavSidebar } from './NavSidebar';

const meta: Meta<typeof NavSidebar> = {
  title: 'navigation/NavSidebar',
  component: NavSidebar,
  decorators: [withRouter],
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof NavSidebar>>;

export const Default: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        path: '/edit',
      },
      routing: reactRouterOutlets([
        {
          path: '/edit',
          element: <div />,
        },
        {
          path: '/history',
          element: <div />,
        },
        {
          path: '/user',
          element: <div />,
        },
        {
          path: '/settings',
          element: <div />,
        },
      ]),
    }),
  },
};

export default meta;
