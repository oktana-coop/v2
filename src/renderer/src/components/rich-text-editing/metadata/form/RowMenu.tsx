import * as Headless from '@headlessui/react';
import clsx from 'clsx';

import { MoreVerticalAltIcon } from '../../../icons';
import { MenuItem, MenuItems } from '../../../menus/Menu';
import { type EditMetadataFn } from './field-props';

export const RowMenu = ({
  metadataKey,
  onEdit,
}: {
  metadataKey: string;
  onEdit: EditMetadataFn;
}) => {
  const handleRemove = () => {
    onEdit({ type: 'removeKey', key: metadataKey });
  };

  return (
    <Headless.Menu>
      <Headless.MenuButton
        aria-label={`Options for ${metadataKey}`}
        className={clsx(
          'flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500 focus:outline-none dark:text-zinc-400',
          'hover:bg-zinc-950/5 hover:text-zinc-950 dark:hover:bg-white/5 dark:hover:text-white',
          'opacity-0 group-hover/row:opacity-100 group-has-[input:focus]/row:opacity-100 group-has-[textarea:focus]/row:opacity-100 data-[focus]:opacity-100 data-[open]:opacity-100'
        )}
      >
        <MoreVerticalAltIcon size={16} />
      </Headless.MenuButton>
      <MenuItems>
        <MenuItem label="Remove" onClick={handleRemove} />
      </MenuItems>
    </Headless.Menu>
  );
};
