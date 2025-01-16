import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const classes =
  'font-bold text-lg text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const Heading3 = ({ children, className }: HeadingProps) => (
  <h3 className={clsx(classes, className)}>{children}</h3>
);
