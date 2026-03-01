import { useMemo, useState } from 'react';

import { clsx } from 'clsx';

import {
  type File,
  removeExtension,
} from '../../../../modules/infrastructure/filesystem';
import { ChevronDownIcon, FileDocumentIcon, FolderIcon } from '../icons';

type FileNode = {
  type: 'file';
  name: string;
  id: string;
  isSelected: boolean;
};

type DirNode = {
  type: 'directory';
  name: string;
  children: TreeNode[];
};

type TreeNode = FileNode | DirNode;

const buildTree = (
  files: Array<File>,
  directoryName: string | null,
  selectedFilePath: string | null
): TreeNode[] => {
  const root: TreeNode[] = [];

  for (const file of files) {
    let relativePath = file.path;

    // Browser adapter includes the directory name as a prefix — strip it
    if (directoryName && relativePath.startsWith(directoryName + '/')) {
      relativePath = relativePath.slice(directoryName.length + 1);
    }

    // Split on both / and \ to handle all platforms
    const parts = relativePath.split(/[/\\]/);
    const dirParts = parts.slice(0, -1);

    let level = root;
    for (const dirPart of dirParts) {
      let dirNode = level.find(
        (n): n is DirNode => n.type === 'directory' && n.name === dirPart
      );
      if (!dirNode) {
        dirNode = { type: 'directory', name: dirPart, children: [] };
        level.push(dirNode);
      }
      level = dirNode.children;
    }

    level.push({
      type: 'file',
      name: removeExtension(file.name),
      id: file.path,
      isSelected: file.path === selectedFilePath,
    });
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.type === 'directory' && sort(n.children));
  };

  sort(root);
  return root;
};

const FileNodeView = ({
  node,
  depth,
  onSelectItem,
}: {
  node: FileNode;
  depth: number;
  onSelectItem: (id: string) => Promise<void>;
}) => (
  <li
    className={clsx(
      'hover:bg-zinc-950/5 dark:hover:bg-white/5',
      node.isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
    )}
  >
    <button
      className="flex w-full items-center truncate bg-transparent py-1 pr-4 text-left text-black dark:text-white"
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
      title={node.name}
      onClick={() => onSelectItem(node.id)}
    >
      <FileDocumentIcon className="mr-1 shrink-0" size={14} />
      {node.name}
    </button>
  </li>
);

const DirNodeView = ({
  node,
  depth,
  onSelectItem,
}: {
  node: DirNode;
  depth: number;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <li>
      <button
        className="flex w-full items-center truncate bg-transparent py-1 pr-4 text-left text-black dark:text-white hover:bg-zinc-950/5 dark:hover:bg-white/5"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <ChevronDownIcon
          className={clsx(
            'mr-1 shrink-0 transition-transform duration-150',
            !expanded && '-rotate-90'
          )}
          size={14}
        />
        <FolderIcon className="mr-1 shrink-0" size={14} />
        {node.name}
      </button>
      {expanded && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.type === 'file' ? child.id : `dir:${child.name}`}
              node={child}
              depth={depth + 1}
              onSelectItem={onSelectItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const TreeNodeView = ({
  node,
  depth,
  onSelectItem,
}: {
  node: TreeNode;
  depth: number;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  if (node.type === 'file') {
    return (
      <FileNodeView node={node} depth={depth} onSelectItem={onSelectItem} />
    );
  }
  return <DirNodeView node={node} depth={depth} onSelectItem={onSelectItem} />;
};

export const FileTree = ({
  files,
  directoryName,
  selectedFilePath,
  onSelectItem,
}: {
  files: Array<File>;
  directoryName: string | null;
  selectedFilePath: string | null;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  const tree = useMemo(
    () => buildTree(files, directoryName, selectedFilePath),
    [files, directoryName, selectedFilePath]
  );

  return (
    <ul className="flex flex-col items-stretch text-sm text-black dark:text-white">
      {tree.map((node) => (
        <TreeNodeView
          key={node.type === 'file' ? node.id : `dir:${node.name}`}
          node={node}
          depth={0}
          onSelectItem={onSelectItem}
        />
      ))}
    </ul>
  );
};
