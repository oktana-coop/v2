import { clsx } from 'clsx';
import { type NodeApi, type NodeRendererProps } from 'react-arborist';

import { filesystemItemTypes } from '../../../../../../modules/infrastructure/filesystem';
import {
  ChevronDownIcon,
  FileDocumentIcon,
} from '../../../../components/icons';
import { type ExplorerTreeNode } from '../../../../hooks';

const nodeClasses = (node: NodeApi<ExplorerTreeNode>) =>
  clsx(
    'flex items-center h-[32px] cursor-pointer overflow-hidden text-ellipsis text-nowrap text-sm py-0.5 hover:bg-zinc-950/5 dark:hover:bg-white/5',
    node.isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
  );

const DirectoryNode = ({
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
    <ChevronDownIcon
      className={clsx(
        'mr-1 shrink-0 transition-transform duration-150',
        !node.isOpen && '-rotate-90'
      )}
      size={16}
    />
    {node.data.name}
  </div>
);

const FileNode = ({
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
    <FileDocumentIcon className="mr-1 shrink-0" size={16} />
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

  if (node.data.type === filesystemItemTypes.DIRECTORY) {
    return (
      <DirectoryNode node={node} {...nodeRendererProps} onClick={handleClick} />
    );
  }

  return <FileNode node={node} {...nodeRendererProps} onClick={handleClick} />;
};
