import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const Heading1 = ({ children, className }: HeadingProps) => (
  <h1
    className={clsx(
      'font-bold text-4xl text-black dark:text-white text-opacity-90 dark:text-opacity-90',
      className
    )}
  >
    {children}
  </h1>
);
