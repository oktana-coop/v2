import * as Headless from '@headlessui/react';
import clsx from 'clsx';

import { PlusIcon } from '../../../icons';
import { plainField } from './plain-field';

// Styled like a property's name, so that it lines up with the names.
export const AddEntryButton = ({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) => (
  <Headless.Button
    className={clsx(
      className,
      plainField,
      'flex h-6 items-center gap-1 text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white',
      'data-[focus]:ring-1 data-[focus]:ring-inset data-[focus]:ring-purple-500 focus:outline-none dark:data-[focus]:ring-purple-300'
    )}
    onClick={onClick}
  >
    <PlusIcon size={12} />
    Add property
  </Headless.Button>
);
