import clsx from 'clsx';
import { type ReactNode } from 'react';

const markClassName = 'inline-block max-w-full rounded-sm px-1 align-top';

type MarkProps = { className?: string; children: ReactNode };

export const Inserted = ({ className, children }: MarkProps) => (
  <ins className={clsx(markClassName, 'diff-insert no-underline', className)}>
    {children}
  </ins>
);

export const Deleted = ({ className, children }: MarkProps) => (
  <del className={clsx(markClassName, 'diff-delete no-underline', className)}>
    {children}
  </del>
);
