import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const Heading2 = ({ children, className }: HeadingProps) => (
  <h2
    className={clsx(
      'font-bold text-2xl mb-3 text-black dark:text-white text-opacity-90 dark:text-opacity-90',
      className
    )}
  >
    {children}
  </h2>
);
