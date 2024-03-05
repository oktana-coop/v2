import { clsx } from 'clsx';

export function Paragraph({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      {...props}
      data-slot="text"
      className={clsx(
        className,
        'text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400'
      )}
    />
  );
}
