import { clsx } from 'clsx';

import { FileDocumentIcon } from '../../../../components/icons';

export type DocumentListItem = {
  id: string;
  name: string;
  isSelected: boolean;
};

export const DocumentList = ({
  items,
  onSelectItem,
}: {
  items: Array<DocumentListItem>;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  return (
    <ul className="flex flex-col items-stretch text-black dark:text-white">
      {items.map((item) => (
        <li
          key={item.name}
          className={clsx(
            'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
            item.isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
          )}
        >
          <button
            className="flex w-full items-center truncate bg-transparent text-left"
            title={item.name}
            onClick={async () => onSelectItem(item.id)}
          >
            <FileDocumentIcon className="mr-1" size={16} />
            {item.name}
          </button>
        </li>
      ))}
    </ul>
  );
};
