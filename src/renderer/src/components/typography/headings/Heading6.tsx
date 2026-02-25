import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const classes =
  'font-bold text-xs text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const Heading6 = ({ children, className }: HeadingProps) => (
  <h6 className={clsx(classes, className)}>{children}</h6>
);
