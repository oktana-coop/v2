import { Button as HeadlessButton } from '@headlessui/react';
import { clsx } from 'clsx';

import { TouchTarget } from '../actions/Button';

type CommandTriggerProps = {
  onClick: () => void;
};

const CommandPaletteTrigger = ({ onClick }: CommandTriggerProps) => {
  return (
    <HeadlessButton
      className={clsx([
        // Basic layout
        'flex w-3/4 items-center justify-between px-2 py-1 lg:w-2/4 xl:w-1/4',

        // Typography
        'text-sm/4 text-zinc-950 dark:text-white',

        // Border
        'border border-zinc-950/10 data-[hover]:border-zinc-950/20 dark:border-white/10 dark:data-[hover]:border-white/20',

        // Background color
        'bg-zinc-100 dark:bg-white/5',
      ])}
      onClick={onClick}
    >
      <TouchTarget>
        <span className="truncate">Search or jump to…</span>
        <kbd>⌘K</kbd>
      </TouchTarget>
    </HeadlessButton>
  );
};

export const MacTitleBar = () => (
  <div className="flex h-9 select-none border-b border-gray-300 px-2 py-1 [-webkit-app-region:drag] dark:border-neutral-600">
    {/* macOS traffic light spacer */}
    <div className="w-16" />

    {/* Command palette trigger */}
    <div className="flex flex-auto justify-center">
      <CommandPaletteTrigger onClick={() => {}} />
    </div>
  </div>
);
