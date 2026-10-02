import { clsx } from 'clsx';
import { useState } from 'react';
import { type NodeRendererProps } from 'react-arborist';

import { EXPLORER_TREE_NODE } from '../../../../../../../modules/infrastructure/cross-platform';
import {
  filesystemEntryTypes,
  getExtension,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  ChevronDownIcon,
  DiffIcon,
  GroupIcon,
} from '../../../../../components/icons';
import { FileExtensionIcon } from '../../../../../components/navigation';
import {
  treeEditingRowClasses,
  treeRowClasses,
  TreeRowInput,
} from '../../../../../components/tree';
import { useTreeCallbacks } from './TreeView';
import {
  type ExplorerTreeNode,
  NEW_DIRECTORY_NODE_ID,
  NEW_FILE_NODE_ID,
  STRUCTURAL_CONFLICTS_NODE_TYPE,
} from './types';

const NewDirectoryNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => {
  const { onCreateDirectory, onCancelCreateDirectory } = useTreeCallbacks();

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (name) {
      onCreateDirectory(name);
    } else {
      onCancelCreateDirectory();
    }
  };

  return (
    <div
      className={treeEditingRowClasses}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 36,
      }}
    >
      <ChevronDownIcon className="mr-2 shrink-0 -rotate-90" size={20} />
      <TreeRowInput
        className="flex-1"
        onSubmit={handleSubmit}
        onCancel={onCancelCreateDirectory}
      />
    </div>
  );
};

const MISSING_EXTENSION_WARNING =
  'This name has no extension (such as .md). Press Enter again to keep it.';

const NewFileNode = ({ node, style }: NodeRendererProps<ExplorerTreeNode>) => {
  const {
    onCreateDocument,
    onCancelCreateDocument,
    onClearCreateDocumentError,
    createDocumentError,
  } = useTreeCallbacks();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (!name) {
      onCancelCreateDocument();
      return;
    }

    // A name without an extension takes a second Enter.
    if (getExtension(name) === '' && !isConfirming) {
      setIsConfirming(true);
      return;
    }

    onCreateDocument(name);
  };

  const handleChange = () => {
    setIsConfirming(false);
    onClearCreateDocumentError();
  };

  return (
    <div
      className={treeEditingRowClasses}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 40,
      }}
    >
      <FileExtensionIcon fileName={node.data.name} />
      <TreeRowInput
        className="flex-1"
        label="New file name"
        defaultValue={node.data.name}
        mayIncludeExtension
        error={createDocumentError}
        warning={isConfirming ? MISSING_EXTENSION_WARNING : null}
        onSubmit={handleSubmit}
        onCancel={onCancelCreateDocument}
        onChange={handleChange}
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
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (!name) {
      onCancelRenameDocument();
      return;
    }

    // A name without an extension takes a second Enter.
    if (getExtension(name) === '' && !isConfirming) {
      setIsConfirming(true);
      return;
    }

    onRenameDocument(node.data.id, name);
  };

  const handleChange = () => {
    setIsConfirming(false);
    onClearRenameDocumentError();
  };

  return (
    <div
      className={treeEditingRowClasses}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 40,
      }}
    >
      <FileExtensionIcon fileName={node.data.name} />
      <TreeRowInput
        className="flex-1"
        defaultValue={node.data.name}
        mayIncludeExtension
        error={renameDocumentError}
        warning={isConfirming ? MISSING_EXTENSION_WARNING : null}
        onSubmit={handleSubmit}
        onCancel={onCancelRenameDocument}
        onChange={handleChange}
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

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (name) {
      onRenameDirectory(node.data.id, name);
    } else {
      onCancelRenameDirectory();
    }
  };

  return (
    <div
      className={treeEditingRowClasses}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 36,
      }}
    >
      <ChevronDownIcon className="mr-2 shrink-0 -rotate-90" size={20} />
      <TreeRowInput
        className="flex-1"
        defaultValue={node.data.name}
        error={renameDirectoryError}
        onSubmit={handleSubmit}
        onCancel={onCancelRenameDirectory}
        onChange={onClearRenameDirectoryError}
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
      className={treeRowClasses(node.isSelected)}
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
  const { filePathToRename } = useTreeCallbacks();

  if (filePathToRename === node.data.id) {
    return <RenamingFileNode node={node} style={style} {...rest} />;
  }

  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();

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
      className={treeRowClasses(node.isSelected)}
      style={{
        ...style,
        paddingLeft: node.level * 24 + 40,
      }}
    >
      <FileExtensionIcon fileName={node.data.name} />
      {node.data.name}
      {node.data.shared && (
        <span
          className="ml-1 inline-flex shrink-0 text-purple-500 dark:text-purple-300"
          data-testid="shared-document-badge"
        >
          <GroupIcon size={16} />
        </span>
      )}
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
    className={treeRowClasses(node.isSelected)}
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
    if (node.data.type === filesystemEntryTypes.DIRECTORY) {
      node.toggle();
    }
  };

  if (node.data.id === NEW_DIRECTORY_NODE_ID) {
    return <NewDirectoryNode node={node} {...nodeRendererProps} />;
  }

  if (node.data.id === NEW_FILE_NODE_ID) {
    return <NewFileNode node={node} {...nodeRendererProps} />;
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

  if (node.data.type === filesystemEntryTypes.DIRECTORY) {
    if (directoryPathToRename === node.data.id) {
      return <RenamingDirectoryNode node={node} {...nodeRendererProps} />;
    }
    return (
      <DirectoryNode node={node} {...nodeRendererProps} onClick={handleClick} />
    );
  }

  return <FileNode node={node} {...nodeRendererProps} onClick={handleClick} />;
};
