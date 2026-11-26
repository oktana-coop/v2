import { Input } from '@headlessui/react';
import clsx from 'clsx';
import { type ChangeEvent, type KeyboardEvent } from 'react';

import { Field } from '../../../inputs/Fieldset';
import { useTextDraft } from '../use-text-draft';
import { type FieldProps } from './field-props';
import { TextFieldErrors } from './FieldErrors';
import {
  plainFieldFocus,
  plainFieldInvalid,
  plainValueField,
} from './plain-field';
import { validateValue } from './validation';

// One-line text; Enter commits it and leaves the field, Escape leaves it
// without committing.
export const InlinesField = ({
  metadataKey,
  source,
  failure,
  onEdit,
  onClearFailure,
}: FieldProps & { source: string }) => {
  const draft = useTextDraft({
    source,
    failedText: failure?.edit.type === 'setInlines' ? failure.edit.value : null,
    validate: validateValue,
    onFocus: onClearFailure,
    onCommit: ({ base, text }) =>
      onEdit({ type: 'setInlines', key: metadataKey, base, value: text }),
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    draft.onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    draft.onKeyDown(event);

    if (event.key === 'Enter') {
      draft.commit();
    }

    if (event.key === 'Escape') {
      draft.cancel();
    }
  };

  return (
    <Field>
      <Input
        aria-label={metadataKey}
        className={clsx(
          plainValueField,
          plainFieldFocus,
          plainFieldInvalid,
          'block'
        )}
        value={draft.text}
        invalid={draft.validationError !== null || failure !== undefined}
        onFocus={draft.onFocus}
        onChange={handleChange}
        onBlur={draft.onBlur}
        onKeyDown={handleKeyDown}
      />
      <TextFieldErrors
        validationError={draft.validationError}
        failure={failure}
      />
    </Field>
  );
};
