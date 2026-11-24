import { Textarea } from '@headlessui/react';
import clsx from 'clsx';
import { type ChangeEvent, type KeyboardEvent } from 'react';

import { Field } from '../../../inputs/Fieldset';
import { type FieldProps } from './field-props';
import { TextFieldErrors } from './FieldErrors';
import {
  plainFieldFocus,
  plainFieldInvalid,
  plainValueField,
} from './plain-field';
import { useTextDraft } from './use-text-draft';
import { validateValue } from './validation';

// Multi-paragraph text; Enter starts a new line, Cmd/Ctrl+Enter commits it and
// leaves the field, and Escape leaves it without committing.
export const BlocksField = ({
  metadataKey,
  source,
  failure,
  onEdit,
  onClearFailure,
}: FieldProps & { source: string }) => {
  const draft = useTextDraft({
    source,
    failedText: failure?.edit.type === 'setBlocks' ? failure.edit.value : null,
    toText: (text) => text.trimEnd(),
    validate: validateValue,
    onFocus: onClearFailure,
    onCommit: ({ base, text }) =>
      onEdit({ type: 'setBlocks', key: metadataKey, base, value: text }),
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    draft.onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }

    if (event.key === 'Escape') {
      draft.onCancel(event.currentTarget);
    }
  };

  return (
    <Field>
      <Textarea
        aria-label={metadataKey}
        className={clsx(
          plainValueField,
          plainFieldFocus,
          plainFieldInvalid,
          'block resize-none'
        )}
        value={draft.text}
        rows={draft.text.split('\n').length}
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
