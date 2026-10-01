import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { filesystemEntryTypes } from '../../../../../../../modules/infrastructure/filesystem';
import { TreeView } from './TreeView';
import { NEW_DIRECTORY_NODE_ID } from './types';

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
      {
        id: 'file-1',
        name: 'Introduction.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'file-2',
        name: 'Getting Started.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'file-3',
        name: 'API Documentation.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'file-4',
        name: 'Guide.png',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'file-5',
        name: 'Report.docx',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'file-6',
        name: 'config.ts',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'docs-guides',
            name: 'guides',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [
              {
                id: 'docs-guides-formatting',
                name: 'Text Formatting.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-1',
                name: 'Doc 1.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-2',
                name: 'Doc 2.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-3',
                name: 'Doc 3.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-4',
                name: 'Doc 4.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-5',
                name: 'Doc 5.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-6',
                name: 'Doc 6.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-doc-7',
                name: 'Doc 7.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-guides-examples',
                name: 'examples',
                type: filesystemEntryTypes.DIRECTORY,
                shared: false,
                children: [
                  {
                    id: 'docs-guides-examples-basic',
                    name: 'Basic Usage.md',
                    type: filesystemEntryTypes.FILE,
                    shared: false,
                  },
                  {
                    id: 'docs-guides-examples-advanced',
                    name: 'Advanced Techniques.md',
                    type: filesystemEntryTypes.FILE,
                    shared: false,
                  },
                ],
              },
            ],
          },
          {
            id: 'docs-assets',
            name: 'assets',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [
              {
                id: 'docs-assets-screenshots',
                name: 'editor-screenshot.png',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'docs-assets-diagram',
                name: 'architecture.png',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
            ],
          },
          {
            id: 'docs-readme',
            name: 'README.md',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
        ],
      },
      {
        id: 'projects',
        name: 'projects',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'projects-sample',
            name: 'Sample Project.docx',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
          {
            id: 'projects-whitepaper',
            name: 'Whitepaper.pdf',
            type: filesystemEntryTypes.FILE,
            shared: false,
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'articles-intro',
            name: 'Introduction.md',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
          {
            id: 'articles-drafts',
            name: 'drafts',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [],
          },
          {
            id: 'articles-published',
            name: 'published',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [
              {
                id: 'articles-published-first',
                name: 'First Article.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'articles-published-archive',
                name: 'archive',
                type: filesystemEntryTypes.DIRECTORY,
                shared: false,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'templates',
        name: 'templates',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: NEW_DIRECTORY_NODE_ID,
            name: '',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [],
          },
          {
            id: 'existing-child',
            name: 'existing-doc.md',
            type: filesystemEntryTypes.FILE,
            shared: false,
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
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'docs/Getting Started.md',
        name: 'Getting Started.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'docs/API Reference.md',
        name: 'API Reference.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'content-index',
            name: 'Index.md',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
          {
            id: 'content-config',
            name: 'settings.ts',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
          {
            id: 'content-chapters',
            name: 'chapters',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [
              {
                id: 'content-chapters-intro',
                name: 'Chapter 1 - Introduction.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
              },
              {
                id: 'content-chapters-main',
                name: 'Chapter 2 - Main Content.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
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
