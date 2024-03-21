import { clsx } from 'clsx';

import { HeadingProps } from './types';

export const Heading4 = ({ children, className }: HeadingProps) => (
  <h4
    className={clsx(
      'font-bold text-base mb-3 text-black dark:text-white text-opacity-90 dark:text-opacity-90',
      className
    )}
  >
    {children}
  </h4>
);
