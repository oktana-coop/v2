import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { initRepositoryWithCommit } from '../shared/git';
import {
  createAndSwitchToBranch,
  expectFileToContain,
  openDocument,
  openHelloMd,
  openProjectFolder,
  switchToBranch,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  attemptJoinFromCommandPalette,
  cloneAndLaunchApp,
  joinFromCommandPalette,
  launchApp,
  shareFromCommandPalette,
} from './helpers';

test.describe('joining a share', () => {
  test.use({ withSyncServer: true });

  // A share ID names the document it was made from, so joining opens this
  // project's copy of that document, no matter which document is open.
  test('a share for a document other than the open one opens that document', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Both peers hold the same two documents, so a share made from one of them
    // names a document the other has too.
    fs.writeFileSync(
      path.join(aliceProject, 'notes.md'),
      '# Notes\n\nWritten by Alice.\n'
    );
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openDocument({ window: aliceWindow, relativePath: 'notes.md' });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: syncServer!.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });

      // Bob is looking at a different document than the one that was shared.
      await openHelloMd({ window: bob.window });
      const bobEditor = bob.window.locator('.ProseMirror');
      await expect(bobEditor).toContainText('This is a test document');

      await joinFromCommandPalette({ window: bob.window, shareId });

      // The link named notes.md, so that is where Bob ends up.
      await expect(bobEditor).toContainText('Written by Alice', {
        timeout: 20_000,
      });

      // And on the share rather than merely the file: Alice's typing arrives.
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ' and joined',
        delay: 30,
      });
      await expect(bobEditor).toContainText('and joined', { timeout: 20_000 });
    } finally {
      await bob.close();
    }
  });

  test('a share holding text the file lacks writes it to the file as an uncommitted change', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    fs.writeFileSync(
      path.join(aliceProject, 'notes.md'),
      '# Notes\n\nWritten by Alice.\n'
    );
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openDocument({ window: aliceWindow, relativePath: 'notes.md' });
    await typeInEditorSlowly({
      window: aliceWindow,
      text: ' not yet committed',
      delay: 30,
    });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: syncServer!.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await expect(bob.window.getByTestId('uncommitted-changes')).toHaveCount(
        0
      );

      await joinFromCommandPalette({ window: bob.window, shareId });

      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'not yet committed',
        { timeout: 20_000 }
      );
      await expectFileToContain({
        filePath: path.join(bob.projectDir, 'notes.md'),
        text: 'not yet committed',
      });
      await expect(bob.window.getByTestId('uncommitted-changes')).toBeVisible();
      await expect(
        bob.window.getByRole('button', { name: /commit changes/i })
      ).toBeEnabled();
    } finally {
      await bob.close();
    }
  });

  test('a share for a document this project does not have is refused', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Only Alice has this document. Bob's project is a different one.
    fs.writeFileSync(
      path.join(aliceProject, 'notes.md'),
      '# Notes\n\nAlice only.\n'
    );
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openDocument({ window: aliceWindow, relativePath: 'notes.md' });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    const bob = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });

      await attemptJoinFromCommandPalette({ window: bob.window, shareId });

      // Refused in the dialog itself, where opening as a guest is offered.
      await expect(bob.window.getByTestId('join-refusal')).toContainText(
        'The share belongs to a document this project does not have.',
        { timeout: 20_000 }
      );
      await expect(
        bob.window.getByRole('button', { name: 'Open as guest instead' })
      ).toBeVisible();

      // The document Bob had open is left as it was.
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'This is a test document'
      );
    } finally {
      await bob.close();
    }
  });

  test('a share from another branch offers switching to that branch, then joins it', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Alice shares from a branch; Bob holds the same repository, on main.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await createAndSwitchToBranch({ window: aliceWindow, branchName: 'draft' });
    await openHelloMd({ window: aliceWindow });
    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: syncServer!.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await switchToBranch({ window: bob.window, from: 'draft', to: 'main' });
      await openHelloMd({ window: bob.window });

      await attemptJoinFromCommandPalette({ window: bob.window, shareId });

      // Refused with the branch named, and switching offered instead of the
      // guest path.
      await expect(bob.window.getByTestId('join-refusal')).toContainText(
        'The share belongs to branch "draft".',
        { timeout: 20_000 }
      );
      await expect(
        bob.window.getByRole('button', { name: 'Open as guest instead' })
      ).toHaveCount(0);
      await bob.window.getByRole('button', { name: 'Switch to draft' }).click();

      await expect(
        bob.window.getByRole('button', { name: 'draft' })
      ).toBeVisible({ timeout: 10_000 });
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'This is a test document',
        { timeout: 20_000 }
      );

      // Joined on the branch: edits flow.
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ' from draft',
        delay: 30,
      });
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'from draft',
        { timeout: 20_000 }
      );
    } finally {
      await bob.close();
    }
  });
});
