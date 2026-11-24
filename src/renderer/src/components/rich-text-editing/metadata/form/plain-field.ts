import clsx from 'clsx';

// Plain fields: text at rest, a tint on hover, a ring when focused. The
// negative margin keeps their text in line with the values around them.
export const plainField = clsx(
  '-mx-1.5 w-[calc(100%+theme(spacing.3))] px-1.5',
  'bg-transparent text-sm/6 text-zinc-950 placeholder:text-zinc-400 dark:text-white',
  'hover:bg-zinc-950/5 dark:hover:bg-white/5'
);

export const plainFieldFocus =
  'focus:bg-zinc-950/5 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:focus:bg-white/5 dark:focus:ring-purple-300';

export const plainFieldFocusWithin =
  'focus-within:bg-zinc-950/5 focus-within:ring-1 focus-within:ring-purple-500 dark:focus-within:bg-white/5 dark:focus-within:ring-purple-300';

export const plainFieldInvalid =
  'data-[invalid]:ring-1 data-[invalid]:ring-red-500 has-[[data-invalid]]:ring-1 has-[[data-invalid]]:ring-red-500';
