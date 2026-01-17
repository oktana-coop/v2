import { clsx } from 'clsx';

import { FileDocumentIcon } from '../../../../components/icons';
import { type IconProps } from '../../../../components/icons/types';

export type DocumentListItem = {
  id: string;
  name: string;
  isSelected: boolean;
  icon?: React.ComponentType<IconProps>;
};

export const DocumentList = ({
  items,
  onSelectItem,
}: {
  items: Array<DocumentListItem>;
  onSelectItem: (id: string) => Promise<void>;
}) => (
  <ul className="flex flex-col items-stretch text-black dark:text-white">
    {items.map(({ id, name, isSelected, icon: Icon }) => (
      <li
        key={name}
        className={clsx(
          'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
          isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
        )}
      >
        <button
          className="flex w-full items-center truncate bg-transparent text-left"
          title={name}
          onClick={async () => onSelectItem(id)}
        >
          {Icon ? (
            <Icon className="mr-1" size={16} />
          ) : (
            <FileDocumentIcon className="mr-1" size={16} />
          )}
          {name}
        </button>
      </li>
    ))}
  </ul>
);
