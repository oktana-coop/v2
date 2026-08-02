import { type Command } from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { prosemirror } from '../../../../modules/domain/rich-text';
import { IconButton } from '../actions/IconButton';
import { ChevronDownIcon, CloseIcon } from '../icons';
import { Input } from '../inputs/Input';

const {
  findNextSearchMatch,
  findPreviousSearchMatch,
  getActiveSearchMatchIndex,
  getSearchMatches,
  getSearchSeedFromSelection,
  scrollActiveSearchMatchIntoView,
  selectNearestSearchMatch,
  setSearchQuery,
} = prosemirror;

type FindBarProps = {
  view: EditorView | null;
  isOpen: boolean;
  // Incremented on every Ctrl/Cmd+F press so an already-open bar
  // re-seeds from the editor selection and refocuses its input.
  focusToken: number;
  // Incremented on editor transactions so the match info stays live
  // while the document or selection changes.
  refreshToken: number;
  onClose: () => void;
};

export const FindBar = ({
  view,
  isOpen,
  focusToken,
  refreshToken,
  onClose,
}: FindBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string>('');
  const [selectInputToken, setSelectInputToken] = useState<number>(0);

  // Match info is derived from the editor state on every render; the
  // `refreshToken` dependency recomputes it whenever an editor transaction
  // may have changed the matches.
  const matches = useMemo(
    () => (view && isOpen && query ? getSearchMatches(view.state) : []),
    // `refreshToken` is deliberately a dependency: `view.state` mutates in
    // place, so the token is what signals that matches may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, isOpen, query, refreshToken]
  );
  const matchCount = matches.length;
  const activeMatchIndex = view
    ? getActiveSearchMatchIndex(view.state, matches)
    : null;

  const applyQuery = useCallback(
    (search: string) => {
      if (!view) {
        return;
      }
      setSearchQuery(search)(view.state, view.dispatch);
      if (search) {
        selectNearestSearchMatch(view.state, view.dispatch);
        scrollActiveSearchMatchIntoView(view);
      }
    },
    [view]
  );

  // On open (or Ctrl/Cmd+F while open): seed the query from the editor
  // selection and highlight matches.
  useEffect(() => {
    if (!isOpen || !view) {
      return;
    }

    const seed = getSearchSeedFromSelection(view.state) ?? query;
    if (seed !== query) {
      setQuery(seed);
    }
    applyQuery(seed);
    setSelectInputToken((token) => token + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, isOpen]);

  // Focus the input and select its text, so that typing or pasting replaces
  // the seeded query instead of appending to it. Runs in its own effect
  // because selecting must happen after React commits the seeded value to the
  // input — selecting in the effect above would target the previous value and
  // get wiped by the re-render.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [selectInputToken, isOpen]);

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    applyQuery(event.target.value);
  };

  // The commands ask for a scroll themselves, but prosemirror-view drops the
  // request while focus is in the find bar, so scroll the match explicitly.
  const runFindCommand = (command: Command) => {
    if (view) {
      command(view.state, view.dispatch);
      scrollActiveSearchMatchIntoView(view);
    }
  };

  const handleFindNext = () => runFindCommand(findNextSearchMatch);
  const handleFindPrevious = () => runFindCommand(findPreviousSearchMatch);

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        handleFindPrevious();
      } else {
        handleFindNext();
      }
    }
  };

  // Escape is handled on the whole bar (not just the input) so it also
  // closes the bar when one of its buttons is focused. It can't be left to
  // the window-level key bindings there: an open button tooltip consumes
  // Escape (stopPropagation) at the document level before they see it.
  const handleBarKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="absolute right-4 top-14 z-10 flex items-center gap-2 rounded-lg bg-white/75 p-2 shadow-lg ring-1 ring-zinc-950/10 backdrop-blur-xl dark:bg-zinc-800/75 dark:ring-inset dark:ring-white/10"
      onKeyDown={handleBarKeyDown}
    >
      <div className="w-48">
        <Input
          ref={inputRef}
          type="text"
          name="find"
          placeholder="Find in document"
          aria-label="Find in document"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleInputKeyDown}
        />
      </div>
      {/* Always rendered (even with no query) so the bar keeps a constant
       * width and the input doesn't shift as the counter appears. */}
      <span className="min-w-16 whitespace-nowrap text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {!query
          ? null
          : matchCount === 0
            ? 'No results'
            : activeMatchIndex !== null
              ? `${activeMatchIndex + 1} of ${matchCount}`
              : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`}
      </span>
      <IconButton
        icon={<ChevronDownIcon size={20} className="rotate-180" />}
        onClick={handleFindPrevious}
        disabled={matchCount === 0}
        tooltip="Previous match"
      />
      <IconButton
        icon={<ChevronDownIcon size={20} />}
        onClick={handleFindNext}
        disabled={matchCount === 0}
        tooltip="Next match"
      />
      <IconButton
        icon={<CloseIcon size={16} />}
        onClick={onClose}
        tooltip="Close"
      />
    </div>
  );
};
