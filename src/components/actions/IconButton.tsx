import { Button } from './Button';
import type { ReactNode } from 'react';

export type IconButtonProps = {
  icon: ReactNode;
};

export const IconButton = ({ icon }: IconButtonProps) => (
  <Button variant="plain" className="px-0 py-0 sm:px-0 sm:py-0">
    {icon}
  </Button>
);
