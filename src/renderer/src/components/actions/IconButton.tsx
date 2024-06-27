import { forwardRef, type ReactNode } from 'react';

import { Button, type ButtonColor } from './Button';

export type IconButtonProps = {
  icon: ReactNode;
  color?: ButtonColor;
  onClick?: () => void;
};

export const IconButton = forwardRef(function IconButton(
  { icon, color, onClick }: IconButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  return (
    <Button
      variant="plain"
      color={color}
      className="!sm:px-0 !sm:py-0 !px-0 !py-0"
      onClick={onClick}
      ref={ref}
    >
      {icon}
    </Button>
  );
});
