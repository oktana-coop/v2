import { clsx } from 'clsx';
import { NodeRendererProps } from 'react-arborist';

import { type ExplorerTreeNode } from '../../../../hooks';

export const TreeNode = ({
  node,
  style,
}: NodeRendererProps<ExplorerTreeNode>) => (
  <div
    className={clsx(
      'h-[32px] cursor-pointer overflow-hidden text-ellipsis text-nowrap py-1 text-left hover:bg-zinc-950/5 dark:hover:bg-white/5',
      node.isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
    )}
    style={{
      ...style,
      paddingLeft: node.level * 24 + 36,
    }}
  >
    {node.data.name}
  </div>
);
