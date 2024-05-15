import { clsx } from 'clsx';

export const classes =
  'text-base/relaxed text-red text-opacity-90 dark:text-zinc-400';

export function Paragraph({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  return <p {...props} data-slot="text" className={clsx(classes, className)} />;
}
