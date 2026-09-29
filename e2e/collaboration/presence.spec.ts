import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  expectPeerAvatars,
  joinFromCommandPalette,
  launchApp,
  shareFromCommandPalette,
} from './helpers';

test.describe('presence while sharing', () => {
  test.use({ withSyncServer: true });

  test('peers see each other in the actions bar while sharing', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);
    await expectPeerAvatars({ window: aliceWindow, count: 0 });

    const bob = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      await expectPeerAvatars({ window: aliceWindow, count: 1 });
      await expectPeerAvatars({ window: bob.window, count: 1 });
    } finally {
      await bob.close();
    }

    await expectPeerAvatars({ window: aliceWindow, count: 0 });
  });

  test('a typing peer shows a caret after their text at the other peer', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

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
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'presence';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const bobEditor = bob.window.locator('.ProseMirror');
      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      const aliceCaretAtBob = bob.window.getByTestId('presence-caret');
      await expect(aliceCaretAtBob).toHaveCount(1, { timeout: 20_000 });

      // The caret sits right after the typed text once everything settles.
      await expect
        .poll(
          () =>
            bob.window.evaluate(() => {
              const caret = document.querySelector(
                '[data-testid="presence-caret"]'
              );
              return caret?.previousSibling?.textContent ?? '';
            }),
          { timeout: 20_000 }
        )
        .toMatch(new RegExp(`${typed}$`));
    } finally {
      await bob.close();
    }
  });
});
