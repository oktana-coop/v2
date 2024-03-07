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
        'text-base/relaxed text-black text-opacity-90 dark:text-zinc-400'
      )}
    />
  );
}
