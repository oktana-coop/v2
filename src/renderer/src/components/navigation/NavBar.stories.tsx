import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import {
  reactRouterOutlets,
  reactRouterParameters,
  withRouter,
} from 'storybook-addon-remix-react-router';

import { type RendererConfig } from '../../../../modules/config/browser';
import {
  type ProjectId,
  type ProjectType,
  projectTypes,
} from '../../../../modules/domain/project';
import { NavBar } from './NavBar';

const TEST_PROJECT_ID = '/path/to/project' as ProjectId;

const withWindowConfig = (projectType: ProjectType) => (Story: React.FC) => {
  window.config = { projectType } as RendererConfig;
  return <Story />;
};

const meta: Meta<typeof NavBar> = {
  title: 'navigation/Navigation Bar',
  component: NavBar,
  decorators: [
    (Story) => (
      <div style={{ height: '500px' }}>
        <Story />
      </div>
    ),
    withRouter,
  ],
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof NavBar>>;

export const SingleDocumentProject: Story = {
  decorators: [withWindowConfig(projectTypes.SINGLE_DOCUMENT_PROJECT)],
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        path: `/projects/${encodeURIComponent(TEST_PROJECT_ID)}/documents`,
      },
      routing: reactRouterOutlets([
        {
          path: '/projects',
          element: <div />,
        },
        {
          path: `/projects/${encodeURIComponent(TEST_PROJECT_ID)}/documents`,
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

export const MultiDocumentProject: Story = {
  decorators: [withWindowConfig(projectTypes.MULTI_DOCUMENT_PROJECT)],
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        path: `/projects/${encodeURIComponent(TEST_PROJECT_ID)}/documents`,
      },
      routing: reactRouterOutlets([
        {
          path: '/projects',
          element: <div />,
        },
        {
          path: `/projects/${encodeURIComponent(TEST_PROJECT_ID)}/documents`,
          element: <div />,
        },
        {
          path: '/history',
          element: <div />,
        },
        {
          path: `/projects/${encodeURIComponent(TEST_PROJECT_ID)}/history`,
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
