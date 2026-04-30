import * as Headless from '@headlessui/react';
import { clsx } from 'clsx';
import React from 'react';

import { Tooltip } from '../accessibility/Tooltip';
import { ChevronDownIcon } from '../icons';

export type SplitButtonMenuItem = {
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
};

export type SplitButtonColor = 'purple' | 'neutral';

export type SplitButtonProps = {
  primaryLabel: React.ReactNode;
  onPrimaryClick: () => void;
  primaryTooltip?: string;
  disabled?: boolean;
  color?: SplitButtonColor;
  menuItems: SplitButtonMenuItem[];
  menuLabel?: string;
  toggleAriaLabel?: string;
};

const sharedButtonClasses = [
  'relative isolate inline-flex items-center font-medium text-sm/6',
  'focus:outline-none focus:z-10 data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500',
  'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
  // Hover/active overlay layer — mirrors the Button component pattern.
  // 10% white wash on top of the base background, applied via an `after`
  // pseudo-element so the base color doesn't shift.
  'after:absolute after:inset-0 after:-z-10',
  'after:data-[hover]:bg-[--btn-hover-overlay] after:data-[active]:bg-[--btn-hover-overlay]',
] as const;

const colorClasses: Record<SplitButtonColor, string> = {
  purple:
    'bg-purple-500 text-white dark:bg-purple-300 dark:text-zinc-950 [--btn-hover-overlay:theme(colors.white/10%)]',
  neutral:
    'bg-zinc-900 text-white dark:bg-zinc-600 [--btn-hover-overlay:theme(colors.white/10%)]',
};

const dividerClasses: Record<SplitButtonColor, string> = {
  purple: 'border-l border-purple-700/50 dark:border-purple-500/40',
  neutral: 'border-l border-zinc-700 dark:border-zinc-500',
};

export const SplitButton = ({
  primaryLabel,
  onPrimaryClick,
  primaryTooltip,
  disabled = false,
  color = 'purple',
  menuItems,
  menuLabel,
  toggleAriaLabel = 'More options',
}: SplitButtonProps) => {
  const primaryButton = (
    <Headless.Button
      onClick={onPrimaryClick}
      disabled={disabled}
      className={clsx(
        ...sharedButtonClasses,
        colorClasses[color],
        'gap-x-1 px-3 py-1',
        // Icons inside the label
        '[&>[data-slot=icon]]:-mx-0.5 [&>[data-slot=icon]]:size-4'
      )}
    >
      {primaryLabel}
    </Headless.Button>
  );

  return (
    <div className="isolate inline-flex items-stretch">
      {primaryTooltip ? (
        <Tooltip text={primaryTooltip} disabled={disabled}>
          {primaryButton}
        </Tooltip>
      ) : (
        primaryButton
      )}
      {menuItems.length > 0 && (
        <Headless.Menu as="div" className="relative flex">
          <Headless.MenuButton
            aria-label={toggleAriaLabel}
            disabled={disabled}
            className={clsx(
              ...sharedButtonClasses,
              colorClasses[color],
              dividerClasses[color],
              'px-1.5 py-1'
            )}
          >
            <ChevronDownIcon size={16} />
          </Headless.MenuButton>
          <Headless.MenuItems
            anchor="bottom end"
            className={clsx(
              'z-10 mt-1 min-w-[14rem] bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none',
              'dark:bg-zinc-800 dark:ring-white/10'
            )}
          >
            {menuLabel && (
              <div
                className={clsx(
                  'px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide',
                  'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {menuLabel}
              </div>
            )}
            {menuItems.map((item, index) => (
              <Headless.MenuItem key={index} disabled={item.disabled}>
                <button
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={clsx(
                    'block w-full px-3 py-2 text-left text-sm',
                    'text-zinc-900 dark:text-white',
                    'data-[focus]:bg-zinc-100 dark:data-[focus]:bg-zinc-700',
                    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
                  )}
                >
                  <div className="font-semibold">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </div>
                  )}
                </button>
              </Headless.MenuItem>
            ))}
          </Headless.MenuItems>
        </Headless.Menu>
      )}
    </div>
  );
};
