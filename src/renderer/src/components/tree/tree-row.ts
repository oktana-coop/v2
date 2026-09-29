import { clsx } from 'clsx';

export const TREE_ROW_HEIGHT = 32;

// A row in a sidebar tree: one line, truncated, lit on hover and when
// selected. Indentation is the tree's, set inline per level.
export const treeRowClasses = (isSelected: boolean) =>
  clsx(
    'flex items-center h-[32px] cursor-pointer overflow-hidden text-ellipsis text-nowrap py-0.5 text-sm hover:bg-zinc-950/5 dark:hover:bg-white/5',
    isSelected && 'bg-purple-50 dark:bg-neutral-600'
  );

// The same row while it holds an input.
export const treeEditingRowClasses =
  'flex h-[32px] items-center overflow-hidden py-0.5 text-sm';
