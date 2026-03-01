import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { filesystemItemTypes } from '../../../../modules/infrastructure/filesystem';
import { FileTree } from './FileTree';

const meta: Meta<typeof FileTree> = {
  title: 'file-tree/FileTree',
  component: FileTree,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-64 rounded border border-zinc-200 dark:border-zinc-700">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<ComponentProps<typeof FileTree>>;

const mockDirectory = {
  type: filesystemItemTypes.DIRECTORY,
  name: 'my-project',
  path: '/home/user/my-project',
  permissionState: 'granted' as PermissionState,
};

const file = (name: string, path: string) => ({
  type: filesystemItemTypes.FILE,
  name,
  path,
});

export const FlatList: Story = {
  args: {
    files: [
      file('intro.vd', 'intro.vd'),
      file('readme.vd', 'readme.vd'),
      file('notes.vd', 'notes.vd'),
    ],
    directoryName: mockDirectory.name,
    selectedFilePath: null,
    onSelectItem: async () => {},
  },
};

export const WithSubdirectories: Story = {
  args: {
    files: [
      file('intro.vd', 'intro.vd'),
      file('meeting.vd', 'notes/meeting.vd'),
      file('ideas.vd', 'notes/ideas.vd'),
      file('report.vd', 'drafts/q1/report.vd'),
      file('outline.vd', 'drafts/outline.vd'),
    ],
    directoryName: mockDirectory.name,
    selectedFilePath: null,
    onSelectItem: async () => {},
  },
};

export const WithSelection: Story = {
  args: {
    files: [
      file('intro.vd', 'intro.vd'),
      file('meeting.vd', 'notes/meeting.vd'),
      file('ideas.vd', 'notes/ideas.vd'),
      file('report.vd', 'drafts/q1/report.vd'),
    ],
    directoryName: mockDirectory.name,
    selectedFilePath: 'notes/meeting.vd',
    onSelectItem: async () => {},
  },
};

export const DeeplyNested: Story = {
  args: {
    files: [
      file('intro.vd', 'intro.vd'),
      file('chapter1.vd', 'book/part1/chapter1.vd'),
      file('chapter2.vd', 'book/part1/chapter2.vd'),
      file('chapter3.vd', 'book/part2/chapter3.vd'),
      file('appendix.vd', 'book/appendix.vd'),
      file('index.vd', 'reference/index.vd'),
    ],
    directoryName: mockDirectory.name,
    selectedFilePath: 'book/part1/chapter1.vd',
    onSelectItem: async () => {},
  },
};

export const BrowserAdapterPaths: Story = {
  name: 'Browser adapter paths (dir prefix)',
  args: {
    files: [
      file('intro.vd', 'my-project/intro.vd'),
      file('meeting.vd', 'my-project/notes/meeting.vd'),
      file('report.vd', 'my-project/drafts/report.vd'),
    ],
    directoryName: mockDirectory.name,
    selectedFilePath: 'my-project/intro.vd',
    onSelectItem: async () => {},
  },
};

export const Empty: Story = {
  args: {
    files: [],
    directoryName: mockDirectory.name,
    selectedFilePath: null,
    onSelectItem: async () => {},
  },
};
