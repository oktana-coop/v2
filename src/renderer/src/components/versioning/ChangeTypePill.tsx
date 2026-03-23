import { clsx } from 'clsx';

import {
  type DocumentChangeType,
  documentChangeTypes,
} from '../../../../modules/infrastructure/version-control';

const pillPropertiesMap = {
  [documentChangeTypes.MODIFIED]: {
    label: 'Modified',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  [documentChangeTypes.ADDED]: {
    label: 'Added',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  [documentChangeTypes.DELETED]: {
    label: 'Deleted',
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  [documentChangeTypes.RENAMED]: {
    label: 'Renamed',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
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
