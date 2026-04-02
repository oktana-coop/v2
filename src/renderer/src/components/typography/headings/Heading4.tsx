import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const classes =
  'font-bold text-base text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const Heading4 = ({ children, className }: HeadingProps) => (
  <h4 className={clsx(classes, className)}>{children}</h4>
);
