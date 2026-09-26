import { describe, expect, it } from 'vitest';

import {
  createOrRefreshGuestShare,
  labelGuestShare,
  replaceOrPrependGuestShare,
  toGuestShare,
} from './guest-share';

const share = (shareId: string, lastOpenedAt: number) => ({
  shareId,
  sharedName: shareId,
  label: null,
  lastOpenedAt,
});

describe('the name of a guest share', () => {
  it('is what the share is called until the user says otherwise', () => {
    expect(
      toGuestShare({ ...share('automerge:a', 1), sharedName: 'note' }).name
    ).toBe('note');
    expect(
      toGuestShare({
        ...share('automerge:a', 1),
        sharedName: 'note',
        label: 'mine',
      }).name
    ).toBe('mine');
  });
});

describe('creating or refreshing a guest share entry', () => {
  it('starts an entry with no label of its own', () => {
    expect(
      createOrRefreshGuestShare({
        existing: undefined,
        shareId: 'automerge:a',
        sharedName: 'note',
        openedAt: 5,
      })
    ).toEqual({
      shareId: 'automerge:a',
      sharedName: 'note',
      label: null,
      lastOpenedAt: 5,
    });
  });

  it('follows the share when it is renamed, and keeps the label given here', () => {
    const existing = {
      shareId: 'automerge:a',
      sharedName: 'note',
      label: 'mine',
      lastOpenedAt: 1,
    };

    expect(
      createOrRefreshGuestShare({
        existing,
        shareId: 'automerge:a',
        sharedName: 'renamed note',
        openedAt: 5,
      })
    ).toEqual({
      shareId: 'automerge:a',
      sharedName: 'renamed note',
      label: 'mine',
      lastOpenedAt: 5,
    });
  });
});

describe('replacing or prepending a guest share', () => {
  const a = {
    shareId: 'automerge:a',
    sharedName: 'a',
    label: null,
    lastOpenedAt: 3,
  };
  const b = {
    shareId: 'automerge:b',
    sharedName: 'b',
    label: null,
    lastOpenedAt: 2,
  };
  const c = {
    shareId: 'automerge:c',
    sharedName: 'c',
    label: null,
    lastOpenedAt: 1,
  };

  it('keeps an opened share where it is, so the list does not reshuffle', () => {
    const opened = { ...c, lastOpenedAt: 9 };

    expect(
      replaceOrPrependGuestShare({ current: [a, b, c], share: opened })
    ).toEqual([a, b, opened]);
  });

  it('puts a new share at the top', () => {
    const joined = {
      shareId: 'automerge:d',
      sharedName: 'd',
      label: null,
      lastOpenedAt: 9,
    };

    expect(
      replaceOrPrependGuestShare({ current: [a, b, c], share: joined })
    ).toEqual([joined, a, b, c]);
  });
});

describe('labeling a guest share', () => {
  const share = {
    shareId: 'automerge:a',
    sharedName: 'note',
    label: null,
    lastOpenedAt: 1,
  };

  it('keeps the label the user typed', () => {
    expect(labelGuestShare({ share, label: ' my notes ' }).label).toBe(
      'my notes'
    );
  });

  it('goes back to the share name on a blank label', () => {
    expect(
      labelGuestShare({ share: { ...share, label: 'mine' }, label: '  ' }).label
    ).toBe(null);
  });
});
