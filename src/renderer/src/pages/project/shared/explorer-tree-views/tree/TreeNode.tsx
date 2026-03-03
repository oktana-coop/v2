import { clsx } from 'clsx';
import { type NodeApi, type NodeRendererProps } from 'react-arborist';

import {
  filesystemItemTypes,
  getExtension,
} from '../../../../../../../modules/infrastructure/filesystem';
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
  STRUCTURAL_CONFLICTS_NODE_TYPE,
} from '../../../../../hooks';

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
        'mr-2 shrink-0 transition-transform duration-150',
        !node.isOpen && '-rotate-90'
      )}
      size={20}
    />
    {node.data.name}
  </div>
);

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
}) => (
  <div
    onClick={onClick}
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
