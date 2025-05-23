import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import {
  reactRouterOutlets,
  reactRouterParameters,
  withRouter,
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
        path: '/documents',
      },
      routing: reactRouterOutlets([
        {
          path: '/documents',
          element: <div />,
        },
        {
          path: '/history',
          element: <div />,
        },
        {
          path: '/options',
          element: <div />,
        },
      ]),
    }),
  },
};

export default meta;
