import { useCurrentBranch } from '../../../../hooks/use-current-branch';

export const BottomBar = () => {
  const currentBranch = useCurrentBranch();

  return (
    <div className="bg-neutral-100 p-1 dark:bg-neutral-900">
      {currentBranch ?? ''}
    </div>
  );
};
