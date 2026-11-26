import { Input } from '@headlessui/react';
import clsx from 'clsx';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useRef,
} from 'react';

import { InvalidMetadataKeyError } from '../../../../../../modules/domain/rich-text';
import { Field } from '../../../inputs/Fieldset';
import { useFormPanel } from '../form-panel';
import { MetadataGridRow } from '../MetadataGrid';
import { type EditMetadataFn, type MetadataEditFailure } from './field-props';
import { TextFieldErrors } from './FieldErrors';
import {
  plainField,
  plainFieldFocus,
  plainFieldInvalid,
  plainValueField,
} from './plain-field';
import { validateKey, validateValue } from './validation';

// A property being added: the key it goes below (null for after the others),
// what's typed in it, and whether it's been committed.
export type NewEntry = {
  after: string | null;
  key: string;
  value: string;
  committed: boolean;
};

// A new property's row. Leaving it commits it once it has a valid name and a
// value; Escape discards it, and so does leaving it with nothing typed.
export const NewEntryRow = ({
  nameInput,
  entry,
  existingKeys,
  failure,
  onChange,
  onDiscard,
  onEdit,
  onClearFailure,
}: {
  nameInput: RefObject<HTMLInputElement>;
  entry: NewEntry;
  existingKeys: string[];
  // The failure of the row's commit.
  failure: MetadataEditFailure | undefined;
  onChange: (entry: NewEntry) => void;
  onDiscard: () => void;
  onEdit: EditMetadataFn;
  onClearFailure: (key: string) => void;
}) => {
  const valueInput = useRef<HTMLInputElement>(null);
  const panel = useFormPanel();
  // Set right before a discarded row's field is left, for the blur to see it.
  const isDiscarded = useRef(false);

  const validatedKey = validateKey(existingKeys)(entry.key);
  const validatedValue = validateValue(entry.value);
  const isBlank = entry.key.trim() === '' && entry.value.trim() === '';
  const keyValidationError = isBlank
    ? null
    : pipe(
        validatedKey,
        Either.match({ onLeft: (message) => message, onRight: () => null })
      );
  const isKeyFailure = failure?.error instanceof InvalidMetadataKeyError;

  const handleFocus = () => {
    if (entry.committed) {
      onClearFailure(entry.key);
      onChange({ ...entry, committed: false });
    }
  };

  const handleKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...entry, key: event.target.value });
  };

  const handleValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...entry, value: event.target.value });
  };

  const handleDiscard = () => {
    isDiscarded.current = true;
    panel.focus();
    onClearFailure(entry.key);
    onDiscard();
  };

  // While the row has typing, undo and redo are contained to the browser's
  // handling of its fields.
  const stopEditHistoryKeyPropagation = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (!isBlank && panel.isEditHistoryKey(event.nativeEvent)) {
      // Kept from the panel, not prevented, so the browser's undo still runs.
      event.stopPropagation();
    }
  };

  const handleKeyKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    stopEditHistoryKeyPropagation(event);

    if (event.key === 'Enter') {
      valueInput.current?.focus();
    }

    if (event.key === 'Escape') {
      handleDiscard();
    }
  };

  const handleValueKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    stopEditHistoryKeyPropagation(event);

    if (event.key === 'Enter') {
      panel.focus();
    }

    if (event.key === 'Escape') {
      handleDiscard();
    }
  };

  // Leaving the row, not moving between its fields.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      isDiscarded.current ||
      event.currentTarget.contains(event.relatedTarget) ||
      entry.committed
    ) {
      return;
    }

    if (isBlank) {
      onDiscard();
      return;
    }

    if (Either.isLeft(validatedKey) || Either.isLeft(validatedValue)) {
      return;
    }

    onEdit({
      type: 'addKey',
      key: validatedKey.right,
      value: validatedValue.right,
      after: entry.after,
    });
    onChange({ ...entry, key: validatedKey.right, committed: true });
  };

  return (
    <Field className="contents" onBlur={handleBlur}>
      <MetadataGridRow
        term={
          <Input
            ref={nameInput}
            aria-label="Name of the new property"
            placeholder="Name"
            className={clsx(
              plainField,
              plainFieldFocus,
              plainFieldInvalid,
              'block min-w-[4ch] max-w-full [field-sizing:content]'
            )}
            value={entry.key}
            invalid={keyValidationError !== null || isKeyFailure}
            onFocus={handleFocus}
            onChange={handleKeyChange}
            onKeyDown={handleKeyKeyDown}
          />
        }
      >
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <Input
              ref={valueInput}
              aria-label="Value of the new property"
              placeholder="Value"
              className={clsx(
                plainValueField,
                plainFieldFocus,
                plainFieldInvalid,
                'block'
              )}
              value={entry.value}
              invalid={failure !== undefined && !isKeyFailure}
              onFocus={handleFocus}
              onChange={handleValueChange}
              onKeyDown={handleValueKeyDown}
            />
          </div>
          {/* Where the other rows have their menu button. */}
          <span className="h-6 w-6 shrink-0" />
        </div>
        <TextFieldErrors
          validationError={keyValidationError}
          failure={failure}
        />
      </MetadataGridRow>
    </Field>
  );
};
