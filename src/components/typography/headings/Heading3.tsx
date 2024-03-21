import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const Heading3 = ({ children, className }: HeadingProps) => (
  <h3
    className={clsx(
      'font-bold text-lg mb-3 text-black dark:text-white text-opacity-90 dark:text-opacity-90',
      className
    )}
  >
    {children}
  </h3>
);
