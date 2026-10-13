import { type Command } from 'prosemirror-state';
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';

import { prosemirror } from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { useKeyBindings } from '../../keyboard';
import { keyBindings } from '../../pages/project/shared/command-palette/key-bindings';
import { IconButton } from '../actions/IconButton';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '../icons';
import { Input } from '../inputs/Input';

const {
  clearSearchQuery,
  findNextSearchMatch,
  findPreviousSearchMatch,
  getActiveSearchMatchIndex,
  getSearchMatches,
  getSearchQueryText,
  getSearchSeedFromSelection,
  scrollActiveSearchMatchIntoView,
  selectFirstMatchAtOrAfterSelection,
  setSearchQuery,
} = prosemirror;

export const FindBar = () => {
  const { view, subscribeToViewState, getViewState } =
    useContext(ProseMirrorContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // The editor state changes outside React, so subscribe to it as an
  // external store: every change re-renders the bar, and everything below
  // is derived fresh from it.
  const editorState = useSyncExternalStore(subscribeToViewState, getViewState);

  const query = editorState ? getSearchQueryText(editorState) : '';
  const matches = editorState && query ? getSearchMatches(editorState) : [];
  const matchCount = matches.length;
  const activeMatchIndex = editorState
    ? getActiveSearchMatchIndex({ state: editorState, matches })
    : null;

  const applyQuery = useCallback(
    (search: string) => {
      if (!view) {
        return;
      }
      setSearchQuery(search)(view.state, view.dispatch);
      if (search) {
        selectFirstMatchAtOrAfterSelection(view.state, view.dispatch);
        scrollActiveSearchMatchIntoView(view);
      }
    },
    [view]
  );

  const handleOpen = () => {
    if (!view) {
      return;
    }

    const seed = getSearchSeedFromSelection(view.state) ?? query;
    applyQuery(seed);

    // setIsOpen only schedules a render, but focus/select below are DOM
    // calls: they need the input mounted and already holding the seed.
    // flushSync forces the render to commit before the next line runs.
    flushSync(() => {
      setIsOpen(true);
    });

    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (view) {
      clearSearchQuery(view.state, view.dispatch);
      view.focus();
    }
  }, [view]);

  useKeyBindings({
    [keyBindings.ctrlF.keyBinding]: handleOpen,
  });

  // Handle Escape key: Close the bar when pressed in the editor or with free focus.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      const { target } = event;
      const targetIsBody = target === document.body;
      const targetInsideEditor =
        target instanceof Node && (view?.dom.contains(target) ?? false);

      if (targetIsBody || targetInsideEditor) {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [isOpen, view, handleClose]);

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    applyQuery(event.target.value);
  };

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

  // Bar-level Escape also covers focused buttons, whose open tooltips
  // consume Escape before the window listener sees it.
  const handleBarKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="search"
      aria-label="Find in document"
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
      {/* Always rendered so the bar keeps a constant width as the counter changes. */}
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
        onClick={handleClose}
        tooltip="Close"
      />
    </div>
  );
};
