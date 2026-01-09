import {
  Button as HeadlessButton,
  type ButtonProps as HeadlessButtonProps,
} from '@headlessui/react';
import { clsx } from 'clsx';
import React from 'react';

import { Link } from './Link';

const styles = {
  size: {
    sm: 'px-[calc(theme(spacing[2.5])-1px)] py-[calc(theme(spacing[1.5])-1px)] text-sm/6',
    md: 'px-[calc(theme(spacing[3]))] py-[calc(theme(spacing[2]))] text-base/6',
    lg: 'px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] text-base/6',
  },
  base: [
    // Base
    'relative isolate inline-flex items-center justify-center gap-x-0.5 border font-medium',

    // Focus
    'focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500',

    // Disabled
    'data-[disabled]:opacity-50',

    // Icon
    '[&>[data-slot=icon]]:-mx-0.5 [&>[data-slot=icon]]:my-0.5 [&>[data-slot=icon]]:size-5 [&>[data-slot=icon]]:shrink-0 [&>[data-slot=icon]]:text-[--btn-icon] [&>[data-slot=icon]]:sm:my-1 [&>[data-slot=icon]]:sm:size-4 forced-colors:[--btn-icon:ButtonText] forced-colors:data-[hover]:[--btn-icon:ButtonText]',
  ],
  solid: [
    // Optical border, implemented as the button background to avoid corner artifacts
    'border-transparent bg-[--btn-border]',

    // Dark mode: border is rendered on `after` so background is set to button background
    'dark:bg-[--btn-bg]',

    // Button background, implemented as foreground layer to stack on top of pseudo-border layer
    'before:absolute before:inset-0 before:-z-10 before:bg-[--btn-bg]',

    // Drop shadow, applied to the inset `before` layer so it blends with the border
    'before:shadow',

    // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
    'dark:before:hidden',

    // Dark mode: Subtle white outline is applied using a border
    'dark:border-white/5',

    // Shim/overlay, inset to match button foreground and used for hover state + highlight shadow
    'after:absolute after:inset-0 after:-z-10',

    // Inner highlight shadow
    'after:shadow-[shadow:inset_0_1px_theme(colors.white/15%)]',

    // White overlay on hover
    'after:data-[active]:bg-[--btn-hover-overlay] after:data-[hover]:bg-[--btn-hover-overlay]',

    // Dark mode: `after` layer expands to cover entire button
    'dark:after:-inset-px',

    // Disabled
    'before:data-[disabled]:shadow-none after:data-[disabled]:shadow-none',
  ],
  outline: [
    // Base
    'border-zinc-950/10 text-zinc-950 data-[active]:bg-zinc-950/[2.5%] data-[hover]:bg-zinc-950/[2.5%]',

    // Dark mode
    'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-[active]:bg-white/5 dark:data-[hover]:bg-white/5',

    // Icon
    '[--btn-icon:theme(colors.zinc.500)] data-[active]:[--btn-icon:theme(colors.zinc.700)] data-[hover]:[--btn-icon:theme(colors.zinc.700)] dark:data-[active]:[--btn-icon:theme(colors.zinc.400)] dark:data-[hover]:[--btn-icon:theme(colors.zinc.400)]',
  ],
  plain: [
    // Base
    'border-transparent data-[active]:bg-zinc-950/5 data-[hover]:bg-zinc-950/5',

    // Dark mode
    'dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10',
  ],
  colors: {
    solid: {
      'dark/zinc': [
        'text-white [--btn-bg:theme(colors.zinc.900)] [--btn-border:theme(colors.zinc.950/90%)] [--btn-hover-overlay:theme(colors.white/10%)]',
        'dark:text-white dark:[--btn-bg:theme(colors.zinc.600)] dark:[--btn-hover-overlay:theme(colors.white/5%)]',
        '[--btn-icon:theme(colors.zinc.400)]',
      ],
      light: [
        'text-zinc-950 [--btn-bg:white] [--btn-border:theme(colors.zinc.950/10%)] [--btn-hover-overlay:theme(colors.zinc.950/2.5%)] data-[active]:[--btn-border:theme(colors.zinc.950/15%)] data-[hover]:[--btn-border:theme(colors.zinc.950/15%)]',
        'dark:text-white dark:[--btn-hover-overlay:theme(colors.white/5%)] dark:[--btn-bg:theme(colors.zinc.800)]',
        '[--btn-icon:theme(colors.zinc.500)]',
      ],
      'dark/white': [
        'text-white [--btn-bg:theme(colors.zinc.900)] [--btn-border:theme(colors.zinc.950/90%)] [--btn-hover-overlay:theme(colors.white/10%)]',
        'dark:text-zinc-950 dark:[--btn-bg:white] dark:[--btn-hover-overlay:theme(colors.zinc.950/5%)]',
        '[--btn-icon:theme(colors.zinc.400)]',
      ],
      purple: [
        'text-white dark:text-zinc-950 [--btn-hover-overlay:theme(colors.white/10%)] [--btn-bg:theme(colors.purple.500)] dark:[--btn-bg:theme(colors.purple.300)] [--btn-border:theme(colors.purple.600/90%)]',
        '[--btn-icon:white] dark:[--btn-icon:theme(colors.zinc.950)]',
      ],
      red: [
        'text-white dark:text-zinc-950 [--btn-hover-overlay:theme(colors.white/10%)] [--btn-bg:theme(colors.red.500)] dark:[--btn-bg:theme(colors.red.300)] [--btn-border:theme(colors.red.600/90%)]',
        '[--btn-icon:white] dark:[--btn-icon:theme(colors.zinc.950)]',
      ],
    },
    outline: {
      'dark/zinc': [
        'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-[active]:bg-white/5 dark:data-[hover]:bg-white/5',
        '[--btn-icon:theme(colors.zinc.500)]',
      ],
      // same with dark/zinc
      light: [
        'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-[active]:bg-white/5 dark:data-[hover]:bg-white/5',
        '[--btn-icon:theme(colors.zinc.500)]',
      ],
      'dark/white': [
        'dark:border-white/15 dark:text-white dark:[--btn-bg:transparent] dark:data-[active]:bg-white/5 dark:data-[hover]:bg-white/5',
        '[--btn-icon:white]',
      ],
      purple: [
        // Base
        'border-purple-500 text-purple-500 data-[active]:bg-purple-50 data-[hover]:bg-purple-50',

        // Dark mode
        'dark:border-purple-100 dark:text-purple-100 dark:[--btn-bg:transparent] dark:data-[active]:bg-purple-50 dark:data-[hover]:bg-purple-50',

        // Icon
        '[--btn-icon:theme(colors.purple.500)] dark:[--btn-icon:theme(colors.purple.100)]',
      ],
      red: [
        // Base
        'border-red-500 text-red-500 data-[active]:bg-red-50 data-[hover]:bg-red-50',

        // Dark mode
        'dark:border-red-100 dark:text-red-100 dark:[--btn-bg:transparent] dark:data-[active]:bg-red-50 dark:data-[hover]:bg-red-50',

        // Icon
        '[--btn-icon:theme(colors.red.500)] dark:[--btn-icon:theme(colors.red.100)]',
      ],
    },
    plain: {
      'dark/zinc': [
        'text-black text-opacity-75 dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10',
        '[--btn-icon:rgba(0,0,0,0.75)] dark:[--btn-icon:theme(colors.white)]',
      ],
      // same with dark/zinc
      light: [
        'text-black text-opacity-75 dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10',
        '[--btn-icon:rgba(0,0,0,0.75)] dark:[--btn-icon:theme(colors.white)]',
      ],
      'dark/white': [
        'text-black text-opacity-75 dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10',
        '[--btn-icon:rgba(0,0,0,0.75)] dark:[--btn-icon:theme(colors.white)]',
      ],
      purple: [
        'text-purple-500 text-opacity-100 dark:text-purple-300 dark:data-[active]:bg-purple-50 dark:data-[hover]:bg-purple-50',
        '[--btn-icon:theme(colors.purple.500)] dark:[--btn-icon:theme(colors.purple.300)]',
      ],
      red: [
        'text-red-500 text-opacity-100 dark:text-red-300 dark:data-[active]:bg-red-50 dark:data-[hover]:bg-red-50',
        '[--btn-icon:theme(colors.red.500)] dark:[--btn-icon:theme(colors.red.300)]',
      ],
    },
  },
};

type ButtonVariant = 'solid' | 'outline' | 'plain';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonColor =
  | keyof typeof styles.colors.solid
  | keyof typeof styles.colors.outline
  | keyof typeof styles.colors.plain;

type ButtonProps = {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
} & {
  children: React.ReactNode;
} & (HeadlessButtonProps | React.ComponentPropsWithoutRef<typeof Link>);

export const Button = React.forwardRef(function Button(
  {
    color = 'dark/zinc',
    variant = 'solid',
    size = 'md',
    className,
    children,
    ...props
  }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = clsx(
    className,
    styles.base,
    styles.size[size],
    clsx(styles[variant], styles.colors[variant][color ?? 'dark/zinc'])
  );

  // TODO: Use 'href' instead of 'to'
  return 'to' in props ? (
    <Link
      {...props}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLAnchorElement>}
    >
      <TouchTarget>{children}</TouchTarget>
    </Link>
  ) : (
    <HeadlessButton {...props} className={classes} ref={ref}>
      <TouchTarget>{children}</TouchTarget>
    </HeadlessButton>
  );
});

/* Expand the hit area to at least 44×44px on touch devices */
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <span
        className="absolute left-1/2 top-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 [@media(pointer:fine)]:hidden"
        aria-hidden="true"
      />
    </>
  );
}
