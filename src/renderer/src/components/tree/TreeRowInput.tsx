import { clsx } from 'clsx';
import { useEffect, useRef } from 'react';

// Inline editing in a tree row: focused and selected on mount, Enter submits
// what was typed, Escape or leaving the field cancels. Keys are kept from
// the tree's own handling, which would otherwise move focus off the field.
export const TreeRowInput = ({
  defaultValue,
  error = null,
  label,
  className,
  onSubmit,
  onCancel,
  onChange,
}: {
  defaultValue?: string;
  error?: string | null;
  label?: string;
  className?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  onChange?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    ev.stopPropagation();

    if (ev.key === 'Enter') onSubmit(ev.currentTarget.value);
    if (ev.key === 'Escape') onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      aria-label={label}
      title={error ?? undefined}
      className={clsx(
        'min-w-0 border bg-transparent px-1 text-sm outline-none',
        error
          ? 'border-red-500 dark:border-red-400'
          : 'border-purple-400 dark:border-purple-300',
        className
      )}
      onKeyDown={handleKeyDown}
      onChange={onChange}
      onBlur={onCancel}
    />
  );
};
