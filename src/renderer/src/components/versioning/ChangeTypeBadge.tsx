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
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  [documentChangeTypes.ADDED]: {
    label: 'A',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  [documentChangeTypes.DELETED]: {
    label: 'D',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  [documentChangeTypes.RENAMED]: {
    label: 'R',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
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
