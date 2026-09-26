import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { initRepositoryWithCommit } from '../shared/git';
import {
  documentEndKey,
  documentStartKey,
  lineEndKey,
  openDocument,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startLatencyProxy } from '../shared/sync-server';
import {
  cloneAndLaunchApp,
  expectTextOverTime,
  joinFromCommandPalette,
  launchApp,
  recordCoarseSyncApplies,
  shareFromCommandPalette,
  sleep,
} from './helpers';

test.use({ withSyncServer: true });

test.describe('convergence without sync latency', () => {
  test('two app instances converge without re-writing tokens', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    const bob = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      // Alice types; Bob only watches.
      const typed = 'mercury venus earth mars jupiter';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${typed}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      await bob.close();
    }
  });

  test('two app instances on the same folder converge without re-writing tokens', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    // Both instances on the same clone: their persists land in the same file,
    // and each sees the other's write through its own watcher.
    const bob = await launchApp({
      syncServiceUrl: syncServer!.url,
      projectDir: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'mercury venus earth mars jupiter';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${typed}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      await bob.close();
    }
  });

  test('typing into a shared title-only document converges without repeating any of the typed text', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // A document holding nothing but a title, open on both peers and shared
    // from one; a single word typed on the sharing side.
    fs.writeFileSync(path.join(aliceProject, 'Foo.md'), '# Foo\n');
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openDocument({ window: aliceWindow, relativePath: 'Foo.md' });

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
      await openDocument({ window: bob.window, relativePath: 'Foo.md' });

      const shareId = await shareFromCommandPalette({ window: aliceWindow });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await typeInEditorSlowly({
        window: aliceWindow,
        text: 'lorem',
        delay: 40,
      });

      // A diff-feedback loop shows up as repeated fragments ("lorereremrem…").
      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: 'Foolorem' }),
        expectTextOverTime({ editor: bobEditor, text: 'Foolorem' }),
      ]);
    } finally {
      await bob.close();
    }
  });
});

test.describe('convergence under sync latency', () => {
  test('two app instances on separate clones converge despite sync latency', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    const bob = await launchApp({ syncServiceUrl: proxy.url });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'mercury venus earth mars jupiter';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${typed}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });

  test('one peer typing with pauses converges when both peers are on laggy connections', async ({
    syncServer,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Closest to a real session: git clones, both peers behind latency, and
    // typing with pauses long enough for saves between words.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    // 100ms per leg: enough lag for stale-base windows, but safely under the
    // 1s WebSocketClientAdapter force-ready that fails the join outright when
    // the handshake's ~5 legs cross it (observed at 150ms under load).
    const aliceProxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 100,
    });
    const bobProxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 100,
    });

    const alice = await launchApp({
      syncServiceUrl: aliceProxy.url,
      projectDir: aliceProject,
    });
    await openProjectFolder({
      electronApp: alice.app,
      window: alice.window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: alice.window });

    const shareId = await shareFromCommandPalette({ window: alice.window });

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: bobProxy.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      // Word by word, pausing longer than the save delay, so the document is
      // saved between words while typing is still going on.
      const tokens = [
        'mercury',
        'venus',
        'earth',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
      ];
      for (const token of tokens) {
        await typeInEditorSlowly({
          window: alice.window,
          text: ` ${token}`,
          delay: 40,
        });
        await sleep(450);
      }

      const aliceEditor = alice.window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${tokens.join(' ')}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      aliceProxy.stop();
      bobProxy.stop();
      await bob.close();
      await alice.close();
    }
  });

  test('two app instances on git clones converge despite sync latency', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // A git project copied to a second folder (a clone), with the second
    // instance on a laggy connection.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: proxy.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'mercury venus earth mars jupiter saturn uranus neptune';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${typed}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });

  test('both peers typing concurrently converge under sync latency', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    const bob = await cloneAndLaunchApp({
      syncServiceUrl: proxy.url,
      source: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const aliceCoarseApplies = recordCoarseSyncApplies(aliceWindow);
      const bobCoarseApplies = recordCoarseSyncApplies(bob.window);

      // Both type at the same time, in different places:
      // Alice at the end of the document, Bob at the heading's end.
      const aliceTyped = 'mercury venus earth mars jupiter';
      const bobTyped = 'red orange yellow green blue';
      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await aliceEditor.click();
      await aliceWindow.keyboard.press(documentEndKey);
      await bobEditor.click();
      await bob.window.keyboard.press(documentStartKey);
      await bob.window.keyboard.press(lineEndKey);

      await Promise.all([
        aliceWindow.keyboard.type(` ${aliceTyped}`, { delay: 30 }),
        bob.window.keyboard.type(` ${bobTyped}`, { delay: 30 }),
      ]);

      // Both editors converge to both sides' typing, each in its place.
      const expected = `Hello ${bobTyped}This is a test document. ${aliceTyped}`;
      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);

      // No coarse applies: every remote change must apply as exact steps, even
      // though the text would converge either way.
      expect([...aliceCoarseApplies, ...bobCoarseApplies]).toEqual([]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });

  // Known failure (kept as the reproduction): with sync latency, two
  // instances persisting the same file livelock through refresh — each sees
  // the other's write as an external edit and re-contributes it at a stale
  // base, duplicating tokens endlessly. Decision 2026-08-13: same-machine
  // same-folder setup is out of scope for now; unskip when that changes.
  test.fixme('two app instances on the same folder converge despite sync latency', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    const bob = await launchApp({
      syncServiceUrl: proxy.url,
      projectDir: aliceProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'mercury venus earth mars jupiter';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      const aliceEditor = aliceWindow.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');
      const expected = `Hello ${typed}This is a test document.`;

      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: expected }),
        expectTextOverTime({ editor: bobEditor, text: expected }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });
});
