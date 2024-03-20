import { Button, type ButtonColor } from './Button';
import type { ReactNode } from 'react';

export type IconButtonProps = {
  icon: ReactNode;
  color?: ButtonColor;
};

export const IconButton = ({ icon, color }: IconButtonProps) => (
  <Button
    variant="plain"
    color={color}
    className="!px-0 !py-0 !sm:px-0 !sm:py-0"
  >
    {icon}
  </Button>
);
