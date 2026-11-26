import clsx from 'clsx';

// Plain fields: text at rest, a tint on hover, a ring inside them when focused.
export const plainField = clsx(
  'bg-transparent px-1.5 text-sm/6 placeholder:text-zinc-400',
  'hover:bg-zinc-950/5 dark:hover:bg-white/5'
);

// A value's plain field; the negative margin keeps its text in line with the
// values around it.
export const plainValueField = clsx(
  plainField,
  '-mx-1.5 w-[calc(100%+theme(spacing.3))] text-zinc-950 dark:text-white'
);

export const plainFieldFocus =
  'focus:bg-zinc-950/5 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-purple-500 dark:focus:bg-white/5 dark:focus:ring-purple-300';

export const plainFieldFocusWithin =
  'focus-within:bg-zinc-950/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-purple-500 dark:focus-within:bg-white/5 dark:focus-within:ring-purple-300';

export const plainFieldInvalid =
  'data-[invalid]:ring-1 data-[invalid]:ring-inset data-[invalid]:ring-red-500 has-[[data-invalid]]:ring-1 has-[[data-invalid]]:ring-inset has-[[data-invalid]]:ring-red-500';
