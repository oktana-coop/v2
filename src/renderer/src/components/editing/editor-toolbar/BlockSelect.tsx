import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { BlockElementType } from '../../../../../modules/rich-text';
import { ChevronDownIcon } from '../../icons';
import { IconProps } from '../../icons/types';
import { Listbox, ListboxLabel, ListboxOption } from '../../inputs/Listbox';

export type BlockSelectProps = {
  value: BlockElementType;
  onSelect: (value: BlockElementType) => void;
  options: Array<{
    label: string;
    value: string;
    icon: React.ComponentType<IconProps>;
  }>;
};

const ListboxButton = ({
  autoFocus,
  ariaLabel,
  className,
  options,
  placeholder,
}: {
  autoFocus?: boolean;
  ariaLabel?: string;
  className?: string;
  options: ReactNode;
  placeholder?: ReactNode;
}) => {
  return (
    <Headless.ListboxButton
      autoFocus={autoFocus}
      data-slot="control"
      aria-label={ariaLabel}
      className={clsx([
        className,
        // Basic layout
        'group relative block flex w-full items-center px-2',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Hide default focus styles
        'focus:outline-none',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:ring-inset after:ring-transparent after:data-[focus]:ring-2 after:data-[focus]:ring-purple-500',
        // Hover state
        'data-[hover]:bg-zinc-950/5 dark:data-[hover]:bg-white/10',
      ])}
    >
      <Headless.ListboxSelectedOption
        as="span"
        options={options}
        placeholder={
          placeholder && (
            <span className="block truncate text-zinc-500">{placeholder}</span>
          )
        }
        className={clsx([
          // Basic layout
          'relative block w-full appearance-none py-[calc(theme(spacing[2.5])-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]',
          // Typography
          'text-left text-base/4 font-medium leading-4 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/4 dark:text-white forced-colors:text-[CanvasText]',
          // Background color
          'bg-transparent',
        ])}
      />
      <ChevronDownIcon size={16} />
    </Headless.ListboxButton>
  );
};

const Options = ({
  options,
  includeLabel = true,
}: {
  options: BlockSelectProps['options'];
  includeLabel?: boolean;
}) => {
  return (
    <>
      {options.map(({ value, label, icon: Icon }) => (
        <ListboxOption key={value} value={value}>
          <Icon />
          {includeLabel && <ListboxLabel>{label}</ListboxLabel>}
        </ListboxOption>
      ))}
    </>
  );
};

export const BlockSelect = ({ value, options, onSelect }: BlockSelectProps) => {
  const handleChange = (value: string) => onSelect(value as BlockElementType);

  return (
    <Listbox
      name="block"
      button={
        <ListboxButton
          options={<Options options={options} includeLabel={false} />}
        />
      }
      value={value}
      onChange={handleChange}
    >
      <Options options={options} />
    </Listbox>
  );
};
