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

import { removeExtension } from '../../../../modules/infrastructure/filesystem';

type Severity = 'error' | 'warning';

const FieldMessage = ({
  id,
  severity,
  message,
  floatingRef,
  floatingStyles,
}: {
  id: string;
  severity: Severity;
  message: string;
  floatingRef: (element: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
}) => {
  const messageClasses: Record<Severity, string> = {
    error:
      'border-red-500 bg-red-50 text-red-800 dark:border-red-400 dark:bg-red-950 dark:text-red-200',
    warning:
      'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100',
  };

  return (
    <FloatingPortal>
      <div
        ref={floatingRef}
        id={id}
        role={severity === 'error' ? 'alert' : 'status'}
        style={floatingStyles}
        className={clsx(
          'z-50 max-w-xs border px-2 py-1 text-xs shadow-md',
          messageClasses[severity]
        )}
      >
        {message}
      </div>
    </FloatingPortal>
  );
};

// Selects what typing should replace: only the name, keeping the extension
// if it's included.
const selectInputText = ({
  input,
  mayIncludeExtension,
}: {
  input: HTMLInputElement;
  mayIncludeExtension: boolean;
}) => {
  const nameLength = removeExtension(input.value).length;

  if (
    mayIncludeExtension &&
    // A name starting with its only dot, like `.gitignore`, has nothing before
    // its extension, so the whole text is selected.
    nameLength > 0
  ) {
    input.setSelectionRange(0, nameLength);
  } else {
    input.select();
  }
};

// Inline editing in a tree row: focused and selected on mount, Enter submits
// what was typed, Escape or leaving the field cancels. Keys are kept from
// the tree's own handling, which would otherwise move focus off the field.
// An error or a warning is shown under the field.
export const TreeRowInput = ({
  defaultValue,
  mayIncludeExtension = false,
  error = null,
  warning = null,
  label,
  className,
  onSubmit,
  onCancel,
  onChange,
}: {
  defaultValue?: string;
  mayIncludeExtension?: boolean;
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
  // An error wins over a warning.
  const severity: Severity = error !== null ? 'error' : 'warning';

  const { refs, floatingStyles } = useFloating({
    open: message !== null,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(2), flip(), shift({ padding: 8 })],
  });
  const inputRefs = useMergeRefs([inputRef, refs.setReference]);

  // Focuses the field and selects its text once, when it appears.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    selectInputText({ input, mayIncludeExtension });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    ev.stopPropagation();

    if (ev.key === 'Enter') onSubmit(ev.currentTarget.value);
    if (ev.key === 'Escape') onCancel();
  };

  const inputBorderClasses: Record<Severity | 'default', string> = {
    error: 'border-red-500 dark:border-red-400',
    warning: 'border-amber-500 dark:border-amber-400',
    default: 'border-purple-400 dark:border-purple-300',
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
          inputBorderClasses[message === null ? 'default' : severity],
          className
        )}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        onBlur={onCancel}
      />
      {message !== null && (
        <FieldMessage
          id={messageId}
          severity={severity}
          message={message}
          floatingRef={refs.setFloating}
          floatingStyles={floatingStyles}
        />
      )}
    </>
  );
};
