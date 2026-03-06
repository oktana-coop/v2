import { expect, test } from './fixtures';
import { openProjectFolder, typeInEditor } from './helpers';

test('opens a project folder and lists documents', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });

  // Both .md files should appear in the sidebar
  await expect(window.getByText('hello')).toBeVisible();
  await expect(window.getByText('world')).toBeVisible();

  await window.screenshot({ path: 'e2e-results/screenshots/project-open.png' });
});

test('opens a document and edits it in ProseMirror', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });

  // Click the first document in the sidebar
  await window.getByText('hello').click();

  // ProseMirror editor root (.ProseMirror) should be visible and contain initial content
  const editor = window.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  await expect(editor.locator('h1')).toHaveText('Hello');

  // Type some new content
  await typeInEditor({ window, text: ' — edited' });

  // Verify the DOM reflects the edit
  await expect(editor).toContainText('Hello — edited');

  await window.screenshot({ path: 'e2e-results/screenshots/editor-edit.png' });
});
