import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const classes =
  'font-bold text-sm text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const Heading5 = ({ children, className }: HeadingProps) => (
  <h5 className={clsx(classes, className)}>{children}</h5>
);
