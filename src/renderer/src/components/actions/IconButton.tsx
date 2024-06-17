import type { ReactNode } from 'react';

import { Button, type ButtonColor } from './Button';

export type IconButtonProps = {
  icon: ReactNode;
  color?: ButtonColor;
  onClick?: () => void;
};

export const IconButton = ({ icon, color, onClick }: IconButtonProps) => (
  <Button
    variant="plain"
    color={color}
    className="!sm:px-0 !sm:py-0 !px-0 !py-0"
    onClick={onClick}
  >
    {icon}
  </Button>
);
