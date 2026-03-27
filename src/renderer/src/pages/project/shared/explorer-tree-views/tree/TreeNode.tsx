import { clsx } from 'clsx';
import { useContext, useEffect, useRef } from 'react';
import { type NodeApi, type NodeRendererProps } from 'react-arborist';

import { projectTypes } from '../../../../../../../modules/domain/project';
import { EXPLORER_TREE_NODE } from '../../../../../../../modules/infrastructure/cross-platform';
import { filesystemItemTypes } from '../../../../../../../modules/infrastructure/filesystem';
import { CurrentProjectContext } from '../../../../../app-state';
import { ChevronDownIcon, DiffIcon } from '../../../../../components/icons';
import { FileExtensionIcon } from '../../../../../components/navigation';
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

const RenamingFileNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => {
  const {
    onRenameDocument,
    onCancelRenameDocument,
    onClearRenameDocumentError,
    renameDocumentError,
  } = useTreeCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);

  const fileName = node.data.name;
  const extIndex = fileName.lastIndexOf('.');
  const nameWithoutExt = extIndex >= 0 ? fileName.slice(0, extIndex) : fileName;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    ev.stopPropagation();

    if (ev.key === 'Enter') {
      const value = inputRef.current?.value.trim() ?? '';
      if (value) {
        onRenameDocument(node.data.id, value);
      } else {
        onCancelRenameDocument();
      }
    } else if (ev.key === 'Escape') {
      onCancelRenameDocument();
    }
  };

  const handleChange = () => {
    onClearRenameDocumentError();
  };

  const handleBlur = () => {
    onCancelRenameDocument();
  };

  return (
    <div
      className="flex h-[32px] items-center overflow-hidden py-0.5 text-sm"
      style={{
        ...style,
        paddingLeft: node.level * 24 + 40,
      }}
    >
      <FileExtensionIcon fileName={node.data.name} />
      <input
        ref={inputRef}
        type="text"
        defaultValue={nameWithoutExt}
        title={renameDocumentError ?? undefined}
        className={clsx(
          'min-w-0 flex-1 border bg-transparent px-1 text-sm outline-none',
          renameDocumentError
            ? 'border-red-500 dark:border-red-400'
            : 'border-purple-400 dark:border-purple-300'
        )}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
};

const RenamingDirectoryNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => {
  const {
    onRenameDirectory,
    onCancelRenameDirectory,
    onClearRenameDirectoryError,
    renameDirectoryError,
  } = useTreeCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    ev.stopPropagation();

    if (ev.key === 'Enter') {
      const value = inputRef.current?.value.trim() ?? '';
      if (value) {
        onRenameDirectory(node.data.id, value);
      } else {
        onCancelRenameDirectory();
      }
    } else if (ev.key === 'Escape') {
      onCancelRenameDirectory();
    }
  };

  const handleChange = () => {
    onClearRenameDirectoryError();
  };

  const handleBlur = () => {
    onCancelRenameDirectory();
  };

  return (
    <div
      className="flex h-[32px] items-center overflow-hidden py-0.5 text-sm"
      style={{
        ...style,
        paddingLeft: node.level * 24 + 36,
      }}
    >
      <ChevronDownIcon className="mr-2 shrink-0 -rotate-90" size={20} />
      <input
        ref={inputRef}
        type="text"
        defaultValue={node.data.name}
        title={renameDirectoryError ?? undefined}
        className={clsx(
          'min-w-0 flex-1 border bg-transparent px-1 text-sm outline-none',
          renameDirectoryError
            ? 'border-red-500 dark:border-red-400'
            : 'border-purple-400 dark:border-purple-300'
        )}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
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

const FileNode = ({
  node,
  style,
  onClick,
  ...rest
}: NodeRendererProps<ExplorerTreeNode> & {
  onClick: (ev: React.MouseEvent) => void;
}) => {
  const { projectType } = useContext(CurrentProjectContext);
  const { filePathToRename } = useTreeCallbacks();

  if (filePathToRename === node.data.id) {
    return <RenamingFileNode node={node} style={style} {...rest} />;
  }

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
  const { directoryPathToRename } = useTreeCallbacks();

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
    if (directoryPathToRename === node.data.id) {
      return <RenamingDirectoryNode node={node} {...nodeRendererProps} />;
    }
    return (
      <DirectoryNode node={node} {...nodeRendererProps} onClick={handleClick} />
    );
  }

  return <FileNode node={node} {...nodeRendererProps} onClick={handleClick} />;
};
