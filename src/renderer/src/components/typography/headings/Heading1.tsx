import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const classes =
  'font-bold text-4xl text-black dark:text-white text-opacity-90 dark:text-opacity-90 mb-4';

export const Heading1 = ({ children, className }: HeadingProps) => (
  <h1 className={clsx(classes, className)}>{children}</h1>
);
