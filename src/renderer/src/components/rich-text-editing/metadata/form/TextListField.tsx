import { Input } from '@headlessui/react';
import clsx from 'clsx';
import { type ChangeEvent, type KeyboardEvent, useRef, useState } from 'react';

import { Badge } from '../../../highlighting/Badge';
import { CloseIcon } from '../../../icons';
import { Field } from '../../../inputs/Fieldset';
import { type FieldProps } from './field-props';
import { ClearedMessage, FailureMessage } from './FieldErrors';
import {
  plainField,
  plainFieldFocusWithin,
  plainFieldInvalid,
} from './plain-field';

// A list of one-line text: each item with a button to remove it, and after
// them an input that adds one with Enter or on leaving it; Escape leaves it
// without adding, and Backspace in it, when empty, removes the last item. The
// row is one plain field.
export const TextListField = ({
  metadataKey,
  items,
  failure,
  onEdit,
  onClearFailure,
}: FieldProps & { items: string[] }) => {
  // The item typed while the input is focused.
  const [newItem, setNewItem] = useState<string | null>(null);
  const [isRemovalRefused, setIsRemovalRefused] = useState(false);
  // Set right before the input is left with Escape, for the blur to see it.
  const isCancelled = useRef(false);
  const failedItem =
    failure?.edit.type === 'addListItem' ? failure.edit.item : null;

  const handleAddItem = () => {
    const item = (newItem ?? '').trim();

    if (item !== '') {
      onEdit({ type: 'addListItem', key: metadataKey, item });
    }
  };

  // Removing the last item would remove the property.
  const handleRemoveItem = (item: string) => {
    if (items.length === 1) {
      setIsRemovalRefused(true);
      return;
    }

    setIsRemovalRefused(false);
    onEdit({ type: 'removeListItem', key: metadataKey, item });
  };

  const handleFocus = () => {
    setNewItem(failedItem ?? '');
    setIsRemovalRefused(false);
    onClearFailure();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewItem(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddItem();
      setNewItem('');
    }

    if (event.key === 'Escape') {
      isCancelled.current = true;
      event.currentTarget.blur();
    }

    if (
      event.key === 'Backspace' &&
      event.currentTarget.value === '' &&
      items.length > 0
    ) {
      handleRemoveItem(items[items.length - 1]);
    }
  };

  const handleBlur = () => {
    if (!isCancelled.current) {
      handleAddItem();
    }
    isCancelled.current = false;
    setNewItem(null);
  };

  return (
    <Field>
      <div
        className={clsx(
          plainField,
          plainFieldFocusWithin,
          plainFieldInvalid,
          'flex flex-wrap items-center gap-1 py-0.5'
        )}
      >
        {items.map((item, index) => (
          <Badge key={index} color="zinc">
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              className="rounded-sm opacity-60 hover:opacity-100"
              onClick={() => handleRemoveItem(item)}
            >
              <CloseIcon size={12} />
            </button>
          </Badge>
        ))}
        <Input
          aria-label={`Add to ${metadataKey}`}
          placeholder="Add"
          className="min-w-16 flex-1 bg-transparent text-sm/6 text-zinc-950 placeholder:text-zinc-400 focus:outline-none dark:text-white"
          invalid={failedItem !== null}
          value={newItem ?? failedItem ?? ''}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>
      {isRemovalRefused && <ClearedMessage />}
      {!isRemovalRefused && failure && <FailureMessage failure={failure} />}
    </Field>
  );
};
