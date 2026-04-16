import {
  Disclosure as HeadlessDisclosure,
  DisclosureButton as HeadlessDisclosureButton,
  DisclosurePanel as HeadlessDisclosurePanel,
} from '@headlessui/react';
import { clsx } from 'clsx';

import { ChevronDownIcon } from '../icons';

type ExpansionPanelProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export const ExpansionPanel = ({
  title,
  children,
  defaultOpen = false,
}: ExpansionPanelProps) => (
  <HeadlessDisclosure defaultOpen={defaultOpen} as="div">
    <HeadlessDisclosureButton
      className={clsx(
        'group flex w-full items-center justify-between py-4 text-sm font-medium',
        'text-zinc-900 dark:text-zinc-100',
        'hover:text-zinc-600 dark:hover:text-zinc-300'
      )}
    >
      {title}
      <ChevronDownIcon
        size={16}
        className="transition-transform duration-200 group-data-[open]:rotate-180"
      />
    </HeadlessDisclosureButton>
    <HeadlessDisclosurePanel className="pb-4">
      {children}
    </HeadlessDisclosurePanel>
  </HeadlessDisclosure>
);
