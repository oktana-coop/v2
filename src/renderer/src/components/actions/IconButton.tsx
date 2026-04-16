// IconButton.tsx
import { type ButtonProps as HeadlessButtonProps } from '@headlessui/react';
import { forwardRef, type ReactNode } from 'react';

import { Tooltip } from '../accessibility/Tooltip';
import { Button, type ButtonColor } from './Button';

export type IconButtonProps = {
  icon: ReactNode;
  color?: ButtonColor;
  as?: React.ElementType;
  onClick?: HeadlessButtonProps<React.ElementType>['onClick'];
  disabled?: boolean;
  tooltip?: string;
};

export const IconButton = forwardRef(function IconButton(
  { icon, color, as, onClick, disabled, tooltip }: IconButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const button = (
    <Button
      variant="plain"
      color={color}
      as={as}
      className="!sm:px-0 !sm:py-0 !px-0 !py-0"
      onClick={onClick}
      ref={ref}
      disabled={disabled}
      aria-label={tooltip}
    >
      {icon}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip text={tooltip} disabled={disabled}>
      {button}
    </Tooltip>
  );
});
