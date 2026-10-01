import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useMergeRefs,
} from '@floating-ui/react';
import { clsx } from 'clsx';
import { useEffect, useId, useRef } from 'react';

// Inline editing in a tree row: focused and selected on mount, Enter submits
// what was typed, Escape or leaving the field cancels. Keys are kept from
// the tree's own handling, which would otherwise move focus off the field.
// An error or a warning is shown under the field.
export const TreeRowInput = ({
  defaultValue,
  selectBeforeExtension = false,
  error = null,
  warning = null,
  label,
  className,
  onSubmit,
  onCancel,
  onChange,
}: {
  defaultValue?: string;
  selectBeforeExtension?: boolean;
  error?: string | null;
  warning?: string | null;
  label?: string;
  className?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  onChange?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const message = error ?? warning;

  const { refs, floatingStyles } = useFloating({
    open: message !== null,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(2), flip(), shift({ padding: 8 })],
  });
  const inputRefs = useMergeRefs([inputRef, refs.setReference]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();

    const lastDot = input.value.lastIndexOf('.');
    if (selectBeforeExtension && lastDot > 0) {
      input.setSelectionRange(0, lastDot);
    } else {
      input.select();
    }
    // Selects once, when the field appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    ev.stopPropagation();

    if (ev.key === 'Enter') onSubmit(ev.currentTarget.value);
    if (ev.key === 'Escape') onCancel();
  };

  return (
    <>
      <input
        ref={inputRefs}
        type="text"
        defaultValue={defaultValue}
        aria-label={label}
        aria-invalid={error !== null}
        aria-describedby={message !== null ? messageId : undefined}
        className={clsx(
          'min-w-0 border bg-transparent px-1 text-sm outline-none',
          error
            ? 'border-red-500 dark:border-red-400'
            : warning
              ? 'border-amber-500 dark:border-amber-400'
              : 'border-purple-400 dark:border-purple-300',
          className
        )}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        onBlur={onCancel}
      />
      {message !== null && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={messageId}
            role={error !== null ? 'alert' : 'status'}
            style={floatingStyles}
            className={clsx(
              'z-50 max-w-xs border px-2 py-1 text-xs shadow-md',
              error !== null
                ? 'border-red-500 bg-red-50 text-red-800 dark:border-red-400 dark:bg-red-950 dark:text-red-200'
                : 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100'
            )}
          >
            {message}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
