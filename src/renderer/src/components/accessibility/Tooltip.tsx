import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';
import { cloneElement, type ReactElement, useState } from 'react';

export type TooltipProps = {
  text: string;
  children: ReactElement;
  placement?: Placement;
  delay?: { open?: number; close?: number };
  disabled?: boolean;
  className?: string;
};

export const Tooltip = function Tooltip({
  text,
  children,
  placement = 'top',
  delay,
  disabled = false,
  className = '',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen && !disabled,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(12),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
    ],
    strategy: 'absolute',
  });

  const hover = useHover(context, { delay });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  // Get the existing ref from children if it exists, with proper typing
  const existingRef =
    'ref' in children ? (children.ref as React.Ref<unknown>) : null;
  const mergedRef = useMergeRefs([refs.setReference, existingRef]);

  // Clone the child element and add the reference props
  const childrenWithReferenceProps = cloneElement(children, {
    ref: mergedRef,
    ...getReferenceProps(),
  });

  return (
    <>
      {childrenWithReferenceProps}
      {text && isOpen && !disabled && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className={`z-50 max-w-xs whitespace-nowrap break-words border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm font-medium text-white shadow-lg ${className}`}
          {...getFloatingProps()}
        >
          {text}
        </div>
      )}
    </>
  );
};
