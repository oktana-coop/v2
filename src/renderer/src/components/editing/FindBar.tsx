import { type EditorView } from 'prosemirror-view';
import { useCallback, useEffect, useRef, useState } from 'react';

import { prosemirror } from '../../../../modules/domain/rich-text';
import { IconButton } from '../actions/IconButton';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '../icons';
import { Input } from '../inputs/Input';

const {
  findNextSearchMatch,
  findPreviousSearchMatch,
  getActiveSearchMatchIndex,
  getSearchMatches,
  getSelectedText,
  selectNearestSearchMatch,
  setSearchQuery,
} = prosemirror;

type FindBarProps = {
  view: EditorView | null;
  isOpen: boolean;
  // Incremented on every Ctrl/Cmd+F press so an already-open bar
  // re-seeds from the editor selection and refocuses its input.
  focusToken: number;
  // Incremented on editor transactions so the match count stays live
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
  const [matchCount, setMatchCount] = useState<number>(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number | null>(null);

  const refreshMatchInfo = useCallback(() => {
    if (!view) {
      return;
    }
    const matches = getSearchMatches(view.state);
    setMatchCount(matches.length);
    setActiveMatchIndex(getActiveSearchMatchIndex(view.state, matches));
  }, [view]);

  const applyQuery = useCallback(
    (search: string) => {
      if (!view) {
        return;
      }
      setSearchQuery({ search })(view.state, view.dispatch);
      if (search) {
        selectNearestSearchMatch(view.state, view.dispatch);
      }
      refreshMatchInfo();
    },
    [view, refreshMatchInfo]
  );

  // On open (or Ctrl/Cmd+F while open): seed the query from the editor
  // selection, highlight matches and focus the input.
  useEffect(() => {
    if (!isOpen || !view) {
      return;
    }

    const selectedText = getSelectedText(view.state);
    const seed =
      selectedText && !selectedText.includes('\n') ? selectedText : query;

    if (seed !== query) {
      setQuery(seed);
    }
    applyQuery(seed);

    inputRef.current?.focus();
    inputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, isOpen]);

  useEffect(() => {
    if (isOpen) {
      refreshMatchInfo();
    }
  }, [refreshToken, isOpen, refreshMatchInfo]);

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    applyQuery(event.target.value);
  };

  const handleFindNext = () => {
    if (!view) {
      return;
    }
    findNextSearchMatch(view.state, view.dispatch);
    refreshMatchInfo();
  };

  const handleFindPrevious = () => {
    if (!view) {
      return;
    }
    findPreviousSearchMatch(view.state, view.dispatch);
    refreshMatchInfo();
  };

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
      {query && (
        <span className="min-w-14 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {matchCount === 0
            ? 'No results'
            : activeMatchIndex !== null
              ? `${activeMatchIndex + 1} of ${matchCount}`
              : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`}
        </span>
      )}
      <IconButton
        icon={<ChevronUpIcon size={20} />}
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
