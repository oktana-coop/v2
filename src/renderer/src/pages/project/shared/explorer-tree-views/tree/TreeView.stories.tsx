import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { filesystemItemTypes } from '../../../../../../../modules/infrastructure/filesystem';
import { NEW_DIRECTORY_NODE_ID } from '../../../../../hooks';
import { TreeView } from './TreeView';

const meta: Meta<typeof TreeView> = {
  title: 'navigation/TreeView',
  component: TreeView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          height: '500px',
          width: '400px',
          borderRight: '1px solid rgba(0,0,0,0.1)',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<ComponentProps<typeof TreeView>>;

export const FlatFileList: Story = {
  args: {
    data: [
      { id: 'file-1', name: 'Introduction.md', type: filesystemItemTypes.FILE },
      {
        id: 'file-2',
        name: 'Getting Started.md',
        type: filesystemItemTypes.FILE,
      },
      {
        id: 'file-3',
        name: 'API Documentation.md',
        type: filesystemItemTypes.FILE,
      },
      { id: 'file-4', name: 'Guide.png', type: filesystemItemTypes.FILE },
      { id: 'file-5', name: 'Report.docx', type: filesystemItemTypes.FILE },
      { id: 'file-6', name: 'config.ts', type: filesystemItemTypes.FILE },
    ],
    selection: null,
    onSelectItem: async (id) => console.log('Selected:', id),
  },
};

export const NestedStructure: Story = {
  args: {
    data: [
      {
        id: 'docs',
        name: 'docs',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'docs-guides',
            name: 'guides',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: 'docs-guides-formatting',
                name: 'Text Formatting.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-1',
                name: 'Doc 1.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-2',
                name: 'Doc 2.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-3',
                name: 'Doc 3.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-4',
                name: 'Doc 4.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-5',
                name: 'Doc 5.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-6',
                name: 'Doc 6.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-doc-7',
                name: 'Doc 7.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-guides-examples',
                name: 'examples',
                type: filesystemItemTypes.DIRECTORY,
                children: [
                  {
                    id: 'docs-guides-examples-basic',
                    name: 'Basic Usage.md',
                    type: filesystemItemTypes.FILE,
                  },
                  {
                    id: 'docs-guides-examples-advanced',
                    name: 'Advanced Techniques.md',
                    type: filesystemItemTypes.FILE,
                  },
                ],
              },
            ],
          },
          {
            id: 'docs-assets',
            name: 'assets',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: 'docs-assets-screenshots',
                name: 'editor-screenshot.png',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'docs-assets-diagram',
                name: 'architecture.png',
                type: filesystemItemTypes.FILE,
              },
            ],
          },
          {
            id: 'docs-readme',
            name: 'README.md',
            type: filesystemItemTypes.FILE,
          },
        ],
      },
      {
        id: 'projects',
        name: 'projects',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'projects-sample',
            name: 'Sample Project.docx',
            type: filesystemItemTypes.FILE,
          },
          {
            id: 'projects-whitepaper',
            name: 'Whitepaper.pdf',
            type: filesystemItemTypes.FILE,
          },
        ],
      },
    ],
    selection: null,
    onSelectItem: async (id) => console.log('Selected:', id),
  },
};

export const WithEmptyFolders: Story = {
  args: {
    data: [
      {
        id: 'articles',
        name: 'articles',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'articles-intro',
            name: 'Introduction.md',
            type: filesystemItemTypes.FILE,
          },
          {
            id: 'articles-drafts',
            name: 'drafts',
            type: filesystemItemTypes.DIRECTORY,
            children: [],
          },
          {
            id: 'articles-published',
            name: 'published',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: 'articles-published-first',
                name: 'First Article.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'articles-published-archive',
                name: 'archive',
                type: filesystemItemTypes.DIRECTORY,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'templates',
        name: 'templates',
        type: filesystemItemTypes.DIRECTORY,
        children: [],
      },
    ],
    selection: null,
    onSelectItem: async (id) => console.log('Selected:', id),
  },
};

// The inline-input state shown when creating a new subfolder.
export const WithNewDirectoryInput: Story = {
  args: {
    data: [
      {
        id: 'parent',
        name: 'parent-folder',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: NEW_DIRECTORY_NODE_ID,
            name: '',
            type: filesystemItemTypes.DIRECTORY,
            children: [],
          },
          {
            id: 'existing-child',
            name: 'existing-doc.md',
            type: filesystemItemTypes.FILE,
          },
        ],
      },
    ],
    selection: null,
    onSelectItem: async () => {},
    onCreateDirectory: async (name) => console.log('Create directory:', name),
    onCancelCreateDirectory: () => console.log('Cancel create directory'),
  },
};

// The inline-input state shown when renaming an existing file.
export const WithRenamingFileInput: Story = {
  args: {
    data: [
      {
        id: 'docs/Introduction.md',
        name: 'Introduction.md',
        type: filesystemItemTypes.FILE,
      },
      {
        id: 'docs/Getting Started.md',
        name: 'Getting Started.md',
        type: filesystemItemTypes.FILE,
      },
      {
        id: 'docs/API Reference.md',
        name: 'API Reference.md',
        type: filesystemItemTypes.FILE,
      },
    ],
    selection: null,
    filePathToRename: 'docs/Introduction.md',
    onSelectItem: async () => {},
    onRenameDocument: async (oldPath, newName) =>
      console.log('Rename:', oldPath, '->', newName),
    onCancelRenameDocument: () => console.log('Cancel rename'),
  },
};

// The inline-input state when the rename fails (e.g. name collision).
export const WithRenamingFileInputError: Story = {
  args: {
    ...WithRenamingFileInput.args,
    renameDocumentError: 'A file named "Getting Started.md" already exists.',
  },
};

export const WithSelection: Story = {
  args: {
    data: [
      {
        id: 'content',
        name: 'content',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'content-index',
            name: 'Index.md',
            type: filesystemItemTypes.FILE,
          },
          {
            id: 'content-config',
            name: 'settings.ts',
            type: filesystemItemTypes.FILE,
          },
          {
            id: 'content-chapters',
            name: 'chapters',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: 'content-chapters-intro',
                name: 'Chapter 1 - Introduction.md',
                type: filesystemItemTypes.FILE,
              },
              {
                id: 'content-chapters-main',
                name: 'Chapter 2 - Main Content.md',
                type: filesystemItemTypes.FILE,
              },
            ],
          },
        ],
      },
    ],
    selection: 'content-chapters-intro',
    onSelectItem: async (id) => console.log('Selected:', id),
  },
};
