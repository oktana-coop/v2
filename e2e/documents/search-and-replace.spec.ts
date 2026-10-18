import { Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  modKey,
  selectFirstCommit,
  setupEditorWithText,
} from '../shared/helpers';

const findBar = (window: Page) =>
  window.getByRole('search', { name: /find in document/i });

const findInput = (window: Page) =>
  findBar(window).getByRole('textbox', { name: /find in document/i });

const matchCounter = (window: Page, text: string) =>
  findBar(window).getByText(text);

const matchHighlights = (window: Page) =>
  window.locator('.ProseMirror-search-match');

const activeMatchHighlight = (window: Page) =>
  window.locator('.ProseMirror-active-search-match');

const openFindBar = async ({ window }: { window: Page }) => {
  await window.keyboard.press(`${modKey}+f`);
  await expect(findInput(window)).toBeVisible();
  await expect(findInput(window)).toBeFocused();
};

test('highlights all matches and cycles through them with Enter', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'hello world hello mars hello',
  });

  await openFindBar({ window });
  await findInput(window).fill('hello');

  // The active match is highlighted separately from the other two.
  await expect(activeMatchHighlight(window)).toHaveCount(1);
  await expect(matchHighlights(window)).toHaveCount(2);
  await expect(matchCounter(window, '1 of 3')).toBeVisible();

  await window.keyboard.press('Enter');
  await expect(matchCounter(window, '2 of 3')).toBeVisible();

  await window.keyboard.press('Enter');
  await expect(matchCounter(window, '3 of 3')).toBeVisible();

  // Wraps around the end of the document.
  await window.keyboard.press('Enter');
  await expect(matchCounter(window, '1 of 3')).toBeVisible();

  // Shift+Enter goes back, wrapping around the start.
  await window.keyboard.press('Shift+Enter');
  await expect(matchCounter(window, '3 of 3')).toBeVisible();
});

test('shows no results for a query that does not match', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'hello world',
  });

  await openFindBar({ window });
  await findInput(window).fill('xyz');

  await expect(matchCounter(window, 'No results')).toBeVisible();
  await expect(matchHighlights(window)).toHaveCount(0);
  await expect(activeMatchHighlight(window)).toHaveCount(0);
});

test('seeds the query from the current editor selection', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'alpha beta alpha',
  });

  // Select-all for simplicity: any selection proves the seeding, without the
  // complexity of precise text-selection gestures.
  await window.keyboard.press(`${modKey}+a`);

  await openFindBar({ window });

  await expect(findInput(window)).toHaveValue('alpha beta alpha');
  await expect(matchCounter(window, '1 of 1')).toBeVisible();

  // The seeded text is selected in the input, so typing replaces it.
  await findInput(window).pressSequentially('beta');
  await expect(findInput(window)).toHaveValue('beta');
  await expect(matchCounter(window, '1 of 1')).toBeVisible();
  await expect(activeMatchHighlight(window)).toHaveText('beta');
});

test('Escape closes the find bar and clears the highlights', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'hello world hello',
  });

  await openFindBar({ window });
  await findInput(window).fill('hello');
  await expect(activeMatchHighlight(window)).toHaveCount(1);

  await window.keyboard.press('Escape');

  await expect(findInput(window)).not.toBeVisible();
  await expect(matchHighlights(window)).toHaveCount(0);
  await expect(activeMatchHighlight(window)).toHaveCount(0);
});

test('editing the document while the find bar is open updates the matches', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'hello world',
  });

  await openFindBar({ window });
  await findInput(window).fill('hello');
  await expect(matchCounter(window, '1 of 1')).toBeVisible();

  // Click near the editor's top-left corner.
  await window.locator('.ProseMirror').click({ position: { x: 5, y: 5 } });
  await window.keyboard.press('End');
  await window.keyboard.type(' hello');

  await expect(
    matchHighlights(window).or(activeMatchHighlight(window))
  ).toHaveCount(2);
});

test('finds in the read-only document history view', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await setupEditorWithText({
    electronApp,
    window,
    folderPath: testProjectDir,
    text: 'hello world hello',
  });
  await commitChanges({ window, message: 'add hellos' });
  await selectFirstCommit({ window, commitMessage: 'add hellos' });

  // Wait for the read-only view specifically: the editable editor shows the
  // same text while the history view is still loading.
  await expect(
    window.locator('.ProseMirror[contenteditable="false"]')
  ).toContainText('hello world hello');

  await openFindBar({ window });
  await findInput(window).fill('hello');

  await expect(activeMatchHighlight(window)).toHaveCount(1);
  await expect(matchHighlights(window)).toHaveCount(1);
  await expect(matchCounter(window, '1 of 2')).toBeVisible();

  await window.keyboard.press('Enter');
  await expect(matchCounter(window, '2 of 2')).toBeVisible();

  await window.keyboard.press('Escape');
  await expect(findInput(window)).not.toBeVisible();
  await expect(matchHighlights(window)).toHaveCount(0);
});
