import { clsx } from 'clsx';
import { useContext, useEffect, useRef } from 'react';
import { type NodeApi, type NodeRendererProps } from 'react-arborist';

import { projectTypes } from '../../../../../../../modules/domain/project';
import { EXPLORER_TREE_NODE } from '../../../../../../../modules/infrastructure/cross-platform';
import {
  filesystemItemTypes,
  getExtension,
} from '../../../../../../../modules/infrastructure/filesystem';
import { CurrentProjectContext } from '../../../../../app-state';
import {
  ChevronDownIcon,
  DiffIcon,
  FileDocumentIcon,
  ImageIcon,
  MarkdownIcon,
  PdfIcon,
} from '../../../../../components/icons';
import { DocxIcon } from '../../../../../components/icons/Docx';
import {
  type ExplorerTreeNode,
  NEW_DIRECTORY_NODE_ID,
  STRUCTURAL_CONFLICTS_NODE_TYPE,
} from '../../../../../hooks';
import { useTreeCallbacks } from './TreeView';

const nodeClasses = (node: NodeApi<ExplorerTreeNode>) =>
  clsx(
    'flex items-center h-[32px] cursor-pointer overflow-hidden text-ellipsis text-nowrap text-sm py-0.5 hover:bg-zinc-950/5 dark:hover:bg-white/5',
    node.isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
  );

const NewDirectoryNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => {
  const { onCreateDirectory, onCancelCreateDirectory } = useTreeCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent react-arborist from intercepting keyboard events (e.g. arrow
    // navigation), which would steal focus from the input and trigger onBlur.
    ev.stopPropagation();

    if (ev.key === 'Enter') {
      const value = inputRef.current?.value.trim() ?? '';
      if (value) {
        onCreateDirectory(value);
      } else {
        onCancelCreateDirectory();
      }
    } else if (ev.key === 'Escape') {
      onCancelCreateDirectory();
    }
  };

  const handleBlur = () => {
    onCancelCreateDirectory();
  };

  return (
    <div
      className={clsx(
        'flex h-[32px] items-center overflow-hidden py-0.5 text-sm'
      )}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 36,
      }}
    >
      <ChevronDownIcon className="mr-2 shrink-0 -rotate-90" size={20} />
      <input
        ref={inputRef}
        type="text"
        className="min-w-0 flex-1 border border-purple-400 bg-transparent px-1 text-sm outline-none dark:border-purple-300"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
};

const DirectoryNode = ({
  node,
  style,
  onClick,
}: NodeRendererProps<ExplorerTreeNode> & {
  onClick: (ev: React.MouseEvent) => void;
}) => {
  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();

    window.electronAPI.showContextMenu({
      context: EXPLORER_TREE_NODE,
      nodeType: 'DIRECTORY',
      path: node.data.id,
    });
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={nodeClasses(node)}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 36,
      }}
    >
      <ChevronDownIcon
        className={clsx(
          'mr-2 shrink-0 transition-transform duration-150',
          !node.isOpen && '-rotate-90'
        )}
        size={20}
      />
      {node.data.name}
    </div>
  );
};

const FileExtensionIcon = ({ fileName }: { fileName: string }) => {
  const extension = getExtension(fileName).toLowerCase();

  if (extension === 'md' || extension === 'markdown') {
    return (
      <MarkdownIcon
        className="mr-2 shrink-0 text-purple-500 dark:text-purple-300"
        size={20}
      />
    );
  }

  if (extension === 'docx' || extension === 'doc') {
    return (
      <DocxIcon
        className="mr-2 shrink-0 text-blue-500 dark:text-blue-300"
        size={20}
      />
    );
  }

  if (extension === 'pdf') {
    return (
      <PdfIcon
        className="mr-2 shrink-0 text-red-500 dark:text-red-300"
        size={20}
      />
    );
  }

  if (
    extension === 'png' ||
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'gif'
  ) {
    return (
      <ImageIcon
        className="mr-2 shrink-0 text-indigo-500 dark:text-indigo-300"
        size={20}
      />
    );
  }

  return (
    <FileDocumentIcon
      className="mr-2 shrink-0 text-zinc-700 dark:text-zinc-300"
      size={20}
    />
  );
};

const FileNode = ({
  node,
  style,
  onClick,
}: NodeRendererProps<ExplorerTreeNode> & {
  onClick: (ev: React.MouseEvent) => void;
}) => {
  const { projectType } = useContext(CurrentProjectContext);

  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();

    // TODO: support context menu for single-document projects
    if (projectType !== projectTypes.MULTI_DOCUMENT_PROJECT) return;

    window.electronAPI.showContextMenu({
      context: EXPLORER_TREE_NODE,
      nodeType: 'FILE',
      path: node.data.id,
    });
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={nodeClasses(node)}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 40,
      }}
    >
      <FileExtensionIcon fileName={node.data.name} />
      {node.data.name}
    </div>
  );
};

const StructuralConflictsNode = ({
  node,
  style,
  onClick,
}: NodeRendererProps<ExplorerTreeNode> & {
  onClick: (ev: React.MouseEvent) => void;
}) => (
  <div
    onClick={onClick}
    className={nodeClasses(node)}
    style={{
      ...style,
      paddingLeft: node.level * 24 + 36,
    }}
  >
    <DiffIcon className="mr-1 shrink-0" size={20} />
    {node.data.name}
  </div>
);

export const TreeNode = ({
  node,
  ...nodeRendererProps
}: NodeRendererProps<ExplorerTreeNode>) => {
  const handleClick = (ev: React.MouseEvent) => {
    node.handleClick?.(ev);

    // if the node represents a directory, toggle its collapsed state
    if (node.data.type === filesystemItemTypes.DIRECTORY) {
      node.toggle();
    }
  };

  if (node.data.id === NEW_DIRECTORY_NODE_ID) {
    return <NewDirectoryNode node={node} {...nodeRendererProps} />;
  }

  if (node.data.type === STRUCTURAL_CONFLICTS_NODE_TYPE) {
    return (
      <StructuralConflictsNode
        node={node}
        {...nodeRendererProps}
        onClick={handleClick}
      />
    );
  }

  if (node.data.type === filesystemItemTypes.DIRECTORY) {
    return (
      <DirectoryNode node={node} {...nodeRendererProps} onClick={handleClick} />
    );
  }

  return <FileNode node={node} {...nodeRendererProps} onClick={handleClick} />;
};
