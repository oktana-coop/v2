import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import {
  withRouter,
  reactRouterParameters,
  reactRouterOutlets,
} from 'storybook-addon-remix-react-router';

import { NavBar } from './NavBar';

const meta: Meta<typeof NavBar> = {
  title: 'navigation/Navigation Bar',
  component: NavBar,
  decorators: [withRouter],
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof NavBar>>;

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
