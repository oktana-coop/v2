import { clsx } from 'clsx';

import {
  type DocumentChangeType,
  documentChangeTypes,
} from '../../../../modules/infrastructure/version-control';

const pillPropertiesMap = {
  [documentChangeTypes.MODIFIED]: {
    label: 'Modified',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  },
  [documentChangeTypes.ADDED]: {
    label: 'Added',
    className:
      'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  },
  [documentChangeTypes.DELETED]: {
    label: 'Deleted',
    className:
      'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  },
  [documentChangeTypes.RENAMED]: {
    label: 'Renamed',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
} as const;

export const ChangeTypePill = ({
  changeType,
}: {
  changeType: DocumentChangeType;
}) => {
  const pillProperties = pillPropertiesMap[changeType];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
        pillProperties.className
      )}
    >
      {pillProperties.label}
    </span>
  );
};
