import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import { type ReactNode } from 'react';

export const MenuItems = ({
  anchor = 'bottom end',
  children,
}: {
  anchor?: Headless.MenuItemsProps['anchor'];
  children: ReactNode;
}) => (
  <Headless.MenuItems
    anchor={anchor}
    className={clsx(
      'z-10 mt-1 min-w-[14rem] bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none',
      'dark:bg-zinc-800 dark:ring-white/10'
    )}
  >
    {children}
  </Headless.MenuItems>
);

export const MenuItem = ({
  label,
  description,
  disabled,
  onClick,
}: {
  label: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <Headless.MenuItem disabled={disabled}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'block w-full px-3 py-2 text-left text-sm',
        'text-zinc-900 dark:text-white',
        'data-[focus]:bg-zinc-100 dark:data-[focus]:bg-zinc-700',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
      )}
    >
      <div className="font-semibold">{label}</div>
      {description && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </div>
      )}
    </button>
  </Headless.MenuItem>
);
