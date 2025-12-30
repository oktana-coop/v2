import { Button as HeadlessButton } from '@headlessui/react';
import { clsx } from 'clsx';
import { useContext } from 'react';

import { CommandPaletteContext } from '../../app-state';
import { TouchTarget } from '../actions/Button';

type CommandPaletteTriggerProps = {
  onClick: () => void;
};

const CommandPaletteTrigger = ({ onClick }: CommandPaletteTriggerProps) => (
  <HeadlessButton
    className={clsx([
      // Basic layout
      'flex w-3/4 items-center justify-between rounded-md px-2 py-1 lg:w-2/4 xl:w-1/4',

      // Typography
      'text-sm/4 text-zinc-950 dark:text-white',

      // Focus
      // TODO: Fix this, probably removing the outline is not good for accessibility.
      'focus:bg-zinc-200/50 focus:outline-none dark:focus:bg-white/10',

      // Border
      'border border-zinc-950/10 data-[hover]:border-zinc-950/20 dark:border-white/10 dark:data-[hover]:border-white/20',

      // Background color
      'bg-zinc-100 data-[hover]:bg-zinc-200/50 dark:bg-white/5 dark:data-[hover]:bg-white/10',

      // No-drag property so that the button can receive events, unlike the rest of the title bar (which is draggable).
      '[-webkit-app-region:no-drag]',
    ])}
    onClick={onClick}
  >
    <TouchTarget>
      <span className="truncate">Search or jump to…</span>
      <kbd>⌘K</kbd>
    </TouchTarget>
  </HeadlessButton>
);

export const MacTitleBar = () => {
  const { openCommandPalette } = useContext(CommandPaletteContext);

  return (
    <div className="flex h-9 select-none border-b border-gray-300 px-2 py-1 [-webkit-app-region:drag] dark:border-neutral-600">
      {/* macOS traffic light spacer */}
      <div className="w-16" />

      {/* Command palette trigger */}
      <div className="flex flex-auto justify-center">
        <CommandPaletteTrigger onClick={openCommandPalette} />
      </div>
    </div>
  );
};
