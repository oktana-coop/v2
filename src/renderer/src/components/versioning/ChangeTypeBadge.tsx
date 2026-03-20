import { clsx } from 'clsx';

import {
  type DocumentChangeType,
  documentChangeTypes,
} from '../../../../modules/infrastructure/version-control';

const badgePropertiesMap: Record<
  DocumentChangeType,
  { label: string; className: string }
> = {
  [documentChangeTypes.MODIFIED]: {
    label: 'M',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  },
  [documentChangeTypes.ADDED]: {
    label: 'A',
    className:
      'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  },
  [documentChangeTypes.DELETED]: {
    label: 'D',
    className:
      'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  },
  [documentChangeTypes.RENAMED]: {
    label: 'R',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
};

export const ChangeTypeBadge = ({
  changeType,
}: {
  changeType: DocumentChangeType;
}) => {
  const badgeProperties = badgePropertiesMap[changeType];

  return (
    <span
      className={clsx(
        'inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold',
        badgeProperties.className
      )}
    >
      {badgeProperties.label}
    </span>
  );
};
