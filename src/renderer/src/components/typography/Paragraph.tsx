import { clsx } from 'clsx';

export const classes =
  'text-base/relaxed text-black text-opacity-90 dark:text-white dark:text-opacity-90';

export function Paragraph({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  return <p {...props} data-slot="text" className={clsx(classes, className)} />;
}
