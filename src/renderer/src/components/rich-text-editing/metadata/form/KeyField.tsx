import { Input } from '@headlessui/react';
import clsx from 'clsx';
import { type ChangeEvent, type KeyboardEvent } from 'react';

import { plainField, plainFieldFocus, plainFieldInvalid } from './plain-field';
import { type useTextDraft } from './use-text-draft';

export const KeyField = ({
  metadataKey,
  draft,
  invalid,
}: {
  metadataKey: string;
  draft: ReturnType<typeof useTextDraft>;
  invalid: boolean;
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    draft.onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }

    if (event.key === 'Escape') {
      draft.onCancel(event.currentTarget);
    }
  };

  return (
    <Input
      aria-label={`Name of ${metadataKey}`}
      className={clsx(
        plainField,
        plainFieldFocus,
        plainFieldInvalid,
        'block min-w-[2ch] max-w-full [field-sizing:content]'
      )}
      value={draft.text}
      invalid={invalid}
      onFocus={draft.onFocus}
      onChange={handleChange}
      onBlur={draft.onBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
