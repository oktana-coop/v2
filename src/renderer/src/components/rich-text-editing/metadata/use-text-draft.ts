import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { type KeyboardEvent, useRef, useState } from 'react';

import { useFormPanel } from './form-panel';

// The text typed in a field, and the text it started from: the base an edit
// of it merges from.
export type TextDraft = { base: string; text: string };

// The text a field commits for the text typed in it, or why it can't commit it.
export type Validate = (text: string) => Either.Either<string, string>;

type DraftState =
  | { type: 'idle' }
  | ({ type: 'editing' } & TextDraft)
  // Committed text, shown until the document's value changes.
  | { type: 'committed'; source: string; text: string };

// A text field's draft. Typing changes only the draft; leaving the field
// commits the text its validation gives, unless it's unchanged, invalid or
// cancelled. The text of a failed edit comes back into the field.
export const useTextDraft = ({
  source,
  failedText,
  toText = (text) => text,
  validate,
  onFocus,
  onCommit,
}: {
  // The value the document holds.
  source: string;
  failedText: string | null;
  // The field's text for a value.
  toText?: (source: string) => string;
  validate: Validate;
  onFocus: () => void;
  onCommit: (draft: TextDraft) => void;
}) => {
  const [draft, setDraft] = useState<DraftState>({ type: 'idle' });
  const panel = useFormPanel();
  // Set right before a cancelled draft's field is left, for the blur to see
  // it: a state update wouldn't reach the blur handler in time.
  const isCancelled = useRef(false);

  // The committed text gives way once the document's value changes, also when
  // it later changes back. Set while rendering, so React renders again at once,
  // before committing.
  if (draft.type === 'committed' && draft.source !== source) {
    setDraft({ type: 'idle' });
  }

  const committedText =
    draft.type === 'committed' && draft.source === source ? draft.text : null;
  const text =
    draft.type === 'editing'
      ? draft.text
      : (failedText ?? committedText ?? toText(source));
  const validationError =
    draft.type === 'editing'
      ? pipe(
          validate(draft.text),
          Either.match({ onLeft: (message) => message, onRight: () => null })
        )
      : null;
  const differsFromBase =
    draft.type === 'editing' && draft.text !== toText(draft.base);

  const handleFocus = () => {
    setDraft({
      type: 'editing',
      base: failedText === null ? (committedText ?? source) : source,
      text,
    });
    onFocus();
  };

  const handleChange = (changed: string) => {
    setDraft((current) =>
      current.type === 'editing' ? { ...current, text: changed } : current
    );
  };

  // Leaves the field for the panel, which commits the draft.
  const commit = () => {
    panel.focus();
  };

  const cancel = () => {
    isCancelled.current = true;
    panel.focus();
  };

  // While the field's text differs from its base, undo and redo are contained
  // to the browser's handling of it.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (differsFromBase && panel.isEditHistoryKey(event.nativeEvent)) {
      // Kept from the panel, not prevented, so the browser's undo still runs.
      event.stopPropagation();
    }
  };

  const handleBlur = () => {
    const cancelled = isCancelled.current;
    isCancelled.current = false;

    if (draft.type !== 'editing') {
      return;
    }

    const validated = validate(draft.text);

    if (
      cancelled ||
      Either.isLeft(validated) ||
      validated.right === toText(draft.base)
    ) {
      setDraft({ type: 'idle' });
      return;
    }

    onCommit({ base: draft.base, text: validated.right });
    setDraft({ type: 'committed', source, text: validated.right });
  };

  return {
    text,
    // Why the draft can't be committed, while it's being edited.
    validationError,
    onFocus: handleFocus,
    onChange: handleChange,
    commit,
    cancel,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
  };
};
