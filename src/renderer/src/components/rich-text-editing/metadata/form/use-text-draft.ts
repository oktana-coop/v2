import { useRef, useState } from 'react';

// The text typed in a field, and the text it started from: the base an edit
// of it merges from.
export type TextDraft = { base: string; text: string };

type DraftState =
  | { type: 'idle' }
  | ({ type: 'editing' } & TextDraft)
  // Committed text, shown until the document's value changes.
  | { type: 'committed'; source: string; text: string };

// A text field's draft. Typing changes only the draft; leaving the field
// commits it, unless it's unchanged, cleared or cancelled. The text of a failed
// edit comes back into the field.
export const useTextDraft = ({
  source,
  failedText,
  toText = (text) => text,
  onFocus,
  onCommit,
}: {
  // The value the document holds.
  source: string;
  failedText: string | null;
  // The field's text for a value.
  toText?: (source: string) => string;
  onFocus: () => void;
  onCommit: (draft: TextDraft) => void;
}) => {
  const [draft, setDraft] = useState<DraftState>({ type: 'idle' });
  // Set right before a cancelled draft's field is left, for the blur to see
  // it: a state update wouldn't reach the blur handler in time.
  const isCancelled = useRef(false);

  const committedText =
    draft.type === 'committed' && draft.source === source ? draft.text : null;
  const text =
    draft.type === 'editing'
      ? draft.text
      : (failedText ?? committedText ?? toText(source));

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

  // Leaves the field without committing the draft.
  const handleCancel = (field: HTMLElement) => {
    isCancelled.current = true;
    field.blur();
  };

  const handleBlur = () => {
    const cancelled = isCancelled.current;
    isCancelled.current = false;

    if (draft.type !== 'editing') {
      return;
    }

    if (
      cancelled ||
      draft.text.trim() === '' ||
      draft.text === toText(draft.base)
    ) {
      setDraft({ type: 'idle' });
      return;
    }

    onCommit({ base: draft.base, text: draft.text });
    setDraft({ type: 'committed', source, text: draft.text });
  };

  return {
    text,
    isCleared: draft.type === 'editing' && draft.text.trim() === '',
    onFocus: handleFocus,
    onChange: handleChange,
    onCancel: handleCancel,
    onBlur: handleBlur,
  };
};
