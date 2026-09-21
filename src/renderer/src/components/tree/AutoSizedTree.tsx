import { clsx } from 'clsx';
import { Tree, type TreeApi } from 'react-arborist';
import { AutoSizer } from 'react-virtualized-auto-sizer';

type TreeProps<T> = Parameters<typeof Tree<T>>[0];

// A react-arborist tree filling whatever holds it.
export const AutoSizedTree = <T,>({
  treeRef,
  className,
  ...props
}: Omit<TreeProps<T>, 'width' | 'height' | 'ref'> & {
  treeRef?: React.ForwardedRef<TreeApi<T> | undefined>;
}) => (
  <AutoSizer
    renderProp={({ width, height }) => (
      <Tree
        ref={treeRef}
        width={width ?? '100%'}
        height={height}
        className={clsx('overflow-auto', className)}
        {...props}
      />
    )}
  />
);
