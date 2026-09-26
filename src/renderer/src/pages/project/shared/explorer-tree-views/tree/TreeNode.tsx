import { clsx } from 'clsx';
import { type NodeRendererProps } from 'react-arborist';

import { EXPLORER_TREE_NODE } from '../../../../../../../modules/infrastructure/cross-platform';
import {
  filesystemItemTypes,
  removeExtension,
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
  STRUCTURAL_CONFLICTS_NODE_TYPE,
} from './types';

const NewDirectoryNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => {
  const { onCreateDirectory, onCancelCreateDirectory } = useTreeCallbacks();

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (name) onCreateDirectory(name);
    else onCancelCreateDirectory();
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

  const handleSubmit = (value: string) => {
    const name = value.trim();

    if (name) onRenameDocument(node.data.id, name);
    else onCancelRenameDocument();
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
        defaultValue={removeExtension(node.data.name)}
        error={renameDocumentError}
        onSubmit={handleSubmit}
        onCancel={onCancelRenameDocument}
        onChange={onClearRenameDocumentError}
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

    if (name) onRenameDirectory(node.data.id, name);
    else onCancelRenameDirectory();
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
