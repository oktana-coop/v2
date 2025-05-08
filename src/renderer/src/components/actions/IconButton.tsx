import { type ButtonProps as HeadlessButtonProps } from '@headlessui/react';
import { forwardRef, type ReactNode } from 'react';

import { Button, type ButtonColor } from './Button';

export type IconButtonProps = {
  icon: ReactNode;
  color?: ButtonColor;
  onClick?: HeadlessButtonProps['onClick'];
  disabled?: boolean;
};

export const IconButton = forwardRef(function IconButton(
  { icon, color, onClick, disabled }: IconButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  return (
    <Button
      variant="plain"
      color={color}
      className="!sm:px-0 !sm:py-0 !px-0 !py-0"
      onClick={onClick}
      ref={ref}
      disabled={disabled}
    >
      {icon}
    </Button>
  );
});
