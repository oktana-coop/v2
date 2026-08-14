import { next as Automerge } from '@automerge/automerge';
import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { type ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { initRepositoryWithCommit } from '../shared/git';
import {
  openCommandPalette,
  openDocument,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';

type SharedContent = { shareFormatVersion: number; content: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A local sync service, so the tests exercise the real network path without
// depending on the public service.
const startSyncServer = async (): Promise<{
  url: string;
  stop: () => void;
}> => {
  const port = 3630 + Math.floor(Math.random() * 1000);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-sync-'));

  const server: ChildProcess = spawn(
    process.execPath,
    [path.join('node_modules', '.bin', 'automerge-repo-sync-server')],
    { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir } }
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('sync server did not start')),
      10_000
    );
    server.stdout?.on('data', (data: Buffer) => {
      if (data.toString().includes('Listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.on('error', reject);
  });

  return {
    url: `ws://127.0.0.1:${port}`,
    port,
    stop: () => {
      server.kill();
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {}
    },
  };
};

// Forwards TCP traffic to the sync server with a delay in both directions,
// standing in for the round-trip of a hosted sync service. setTimeout with a
// fixed delay preserves ordering, so frames arrive intact, just later.
const startLatencyProxy = async ({
  targetPort,
  delayMs,
}: {
  targetPort: number;
  delayMs: number;
}): Promise<{ url: string; stop: () => void }> => {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const forward = (from: net.Socket, to: net.Socket) => {
      from.on('data', (chunk) => {
        setTimeout(() => {
          if (!to.destroyed) to.write(chunk);
        }, delayMs);
      });
      from.on('close', () => {
        setTimeout(() => to.destroy(), delayMs);
      });
      from.on('error', () => to.destroy());
    };
    forward(client, upstream);
    forward(upstream, client);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `ws://127.0.0.1:${port}`,
    stop: () => server.close(),
  };
};

// The other peer: a plain automerge-repo client, standing in for the second
// app instance.
const connectPeer = (syncServerUrl: string) => {
  const repo = new Repo({
    network: [new WebSocketClientAdapter(syncServerUrl)],
  });

  return {
    repo,
    disconnect: () => {
      for (const adapter of repo.networkSubsystem.adapters) {
        adapter.disconnect();
      }
    },
  };
};

const shareCurrentDocument = async ({
  window,
}: {
  window: import('@playwright/test').Page;
}): Promise<string> => {
  await openCommandPalette({ window });

  const shareOption = window.getByRole('option', {
    name: 'Share this document',
  });
  await shareOption.waitFor({ state: 'visible', timeout: 2_000 });
  await shareOption.click();

  await window.getByRole('button', { name: 'Share document' }).click();

  const link = window.locator('span.truncate', { hasText: /^automerge:/ });
  await link.waitFor({ state: 'visible', timeout: 10_000 });
  const shareUrl = await link.textContent();
  expect(shareUrl).toMatch(/^automerge:/);

  return shareUrl as string;
};

const closeShareDialog = async ({ window }: { window: Page }) => {
  await window.getByRole('button', { name: 'Done' }).click();
  await window
    .getByRole('button', { name: 'Done' })
    .waitFor({ state: 'hidden', timeout: 5_000 });
};

const joinSharedDocument = async ({
  window,
  shareUrl,
}: {
  window: Page;
  shareUrl: string;
}) => {
  await openCommandPalette({ window });

  const joinOption = window.getByRole('option', {
    name: 'Join shared document',
  });
  await joinOption.waitFor({ state: 'visible', timeout: 2_000 });
  await joinOption.click();

  const input = window.getByPlaceholder('Shared document link');
  await input.fill(shareUrl);
  await input.press('Enter');
  await input.waitFor({ state: 'hidden', timeout: 10_000 });
};

// A second, fully independent app instance: its own user data and its own
// clone of the project, like a collaborator's machine. Passing a projectDir
// makes it open an existing folder instead (two apps on one clone).
const launchSecondApp = async (
  existingProjectDir?: string
): Promise<{
  app: ElectronApplication;
  window: Page;
  projectDir: string;
  close: () => Promise<void>;
}> => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'v2-e2e-userdata-b-')
  );
  const projectDir =
    existingProjectDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-b-'));
  if (!existingProjectDir) {
    fs.writeFileSync(
      path.join(projectDir, 'hello.md'),
      '# Hello\n\nThis is a test document.\n'
    );
  }

  const app = await electron.launch({
    args: [
      path.join(process.cwd(), 'dist/main/index.js'),
      `--user-data-dir=${userDataDir}`,
      ...(process.env.HEADLESS === 'true' ? ['--headless-window'] : []),
    ],
    timeout: 30_000,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return {
    app,
    window,
    projectDir,
    close: async () => {
      await app.close();
      // A borrowed project dir belongs to whoever created it.
      const owned = existingProjectDir
        ? [userDataDir]
        : [userDataDir, projectDir];
      for (const dir of owned) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    },
  };
};

test.describe('realtime collaboration', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    // The repo is created lazily on first share/join, so pointing the app at
    // the local server after load still takes effect.
    await window.evaluate((url) => {
      localStorage.setItem('syncServiceUrl', url);
    }, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  test('tokens written by a peer appear once and the document settles', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });

    const peer = connectPeer(syncServer.url);
    try {
      const handle = await peer.repo.find<SharedContent>(
        shareUrl as Parameters<typeof peer.repo.find>[0],
        { signal: AbortSignal.timeout(15_000) }
      );

      expect(handle.doc().shareFormatVersion).toBe(1);
      expect(handle.doc().content).toContain('This is a test document.');

      // Write like someone typing: one token at a time, replacing the full
      // text so updateText computes the splices.
      const tokens = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
      let text = handle.doc().content.trimEnd();
      for (const token of tokens) {
        text = `${text} ${token}`;
        handle.change((doc) =>
          Automerge.updateText(doc, ['content'], `${text}\n`)
        );
        await sleep(200);
      }

      const editor = window.locator('.ProseMirror');
      await expect(editor).toContainText('alpha bravo charlie delta echo', {
        timeout: 15_000,
      });

      // The document has to settle: the same content on every sample, each
      // token exactly once — a feedback loop keeps rewriting tokens instead.
      const expected = `${text}\n`;
      for (let sample = 0; sample < 8; sample += 1) {
        await sleep(500);

        const crdtContent = handle.doc().content;
        expect(crdtContent).toBe(expected);

        const editorText = (await editor.textContent()) ?? '';
        for (const token of tokens) {
          expect(
            editorText.split(token).length - 1,
            `token "${token}" must appear exactly once in the editor`
          ).toBe(1);
        }
      }

      // The synced text also reaches the sharer's disk.
      await expect
        .poll(
          () => fs.readFileSync(path.join(testProjectDir, 'hello.md'), 'utf8'),
          { timeout: 10_000 }
        )
        .toContain('alpha bravo charlie delta echo');
    } finally {
      peer.disconnect();
    }
  });

  test('typing in the editor does not duplicate text at the other peer', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const peer = connectPeer(syncServer.url);
    try {
      const handle = await peer.repo.find<SharedContent>(
        shareUrl as Parameters<typeof peer.repo.find>[0],
        { signal: AbortSignal.timeout(15_000) }
      );

      // Type like a person: fast enough that changes overlap with their own
      // sync round-trips.
      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const editor = window.locator('.ProseMirror');

      // Wait for the peer to receive all tokens, then require both sides to
      // settle with each token appearing exactly once.
      await expect
        .poll(() => handle.doc().content, { timeout: 15_000 })
        .toContain('five');

      for (let sample = 0; sample < 8; sample += 1) {
        await sleep(500);

        const crdtContent = handle.doc().content;
        const editorText = (await editor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            crdtContent.split(token).length - 1,
            `token "${token}" must appear exactly once at the peer, got: ${JSON.stringify(crdtContent)}`
          ).toBe(1);
          expect(
            editorText.split(token).length - 1,
            `token "${token}" must appear exactly once in the editor, got: ${JSON.stringify(editorText)}`
          ).toBe(1);
        }
      }
    } finally {
      peer.disconnect();
    }
  });

  test('two app instances converge without re-writing tokens', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp();
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, syncServer.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: second.projectDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      // Alice types; Bob only watches.
      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      // Both editors have to settle with each token appearing exactly once;
      // a feedback loop keeps re-writing tokens instead.
      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      await second.close();
    }
  });

  test('two app instances on the same folder converge without re-writing tokens', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    // Both instances on the same clone: their persists land in the same file,
    // and each sees the other's write through its own watcher.
    const second = await launchSecondApp(testProjectDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, syncServer.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: second.projectDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      await second.close();
    }
  });

  test('two app instances on separate clones converge despite sync latency', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    const proxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp();
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, proxy.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: second.projectDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      proxy.stop();
      await second.close();
    }
  });

  test('typing into a title-only document does not loop', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    // The reported recipe: a document holding nothing but a title, open on
    // both peers, shared from one; a single word typed on the sharing side.
    fs.writeFileSync(path.join(testProjectDir, 'Foo.md'), '# Foo\n');
    initRepositoryWithCommit({ repoDir: testProjectDir, message: 'base' });
    const bobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-bobclone-'));
    fs.cpSync(testProjectDir, bobDir, { recursive: true });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openDocument({ window, relativePath: 'Foo.md' });

    const second = await launchSecondApp(bobDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, syncServer.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: bobDir,
      });
      await openDocument({ window: second.window, relativePath: 'Foo.md' });

      const shareUrl = await shareCurrentDocument({ window });
      await closeShareDialog({ window });
      await joinSharedDocument({ window: second.window, shareUrl });

      // Into the trailing paragraph under the title, like a person would.
      const editor = window.locator('.ProseMirror');
      await editor.click();
      await window.keyboard.press(
        os.platform() === 'darwin' ? 'Meta+ArrowDown' : 'Control+End'
      );
      await window.keyboard.type('lorem', { delay: 40 });

      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText('lorem', { timeout: 20_000 });

      // The exact converged text, stable on every sample: any diff-feedback
      // loop shows up as repeated fragments ("lorereremrem…").
      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        expect(await aliceEditor.textContent()).toBe('Foolorem');
        expect(await bobEditor.textContent()).toBe('Foolorem');
      }
    } finally {
      await second.close();
      try {
        fs.rmSync(bobDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('one peer typing with pauses converges when both peers are on laggy connections', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    // Closest to a real session: git clones, both peers behind latency, and
    // typing with pauses long enough for persist and refresh cycles to run
    // between words.
    initRepositoryWithCommit({ repoDir: testProjectDir, message: 'base' });
    const bobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-bobclone-'));
    fs.cpSync(testProjectDir, bobDir, { recursive: true });

    // 100ms per leg: enough lag for stale-base windows, but safely under the
    // 1s WebSocketClientAdapter force-ready that fails the join outright when
    // the handshake's ~5 legs cross it (observed at 150ms under load).
    const aliceProxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 100,
    });
    const bobProxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 100,
    });

    // Overrides the beforeEach direct URL; the repo only dials on first
    // share, which happens later.
    await window.evaluate((url) => {
      localStorage.setItem('syncServiceUrl', url);
    }, aliceProxy.url);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp(bobDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, bobProxy.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: bobDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      // Word …pause… word …pause…: each pause crosses the persist debounce,
      // so disk writes, watcher events and refreshes interleave with typing.
      const tokens = [
        'alpha',
        'bravo',
        'charlie',
        'delta',
        'echo',
        'foxtrot',
        'golf',
        'hotel',
      ];
      for (const token of tokens) {
        await typeInEditorSlowly({ window, text: ` ${token}`, delay: 40 });
        await sleep(450);
      }

      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(tokens.join(' '), {
        timeout: 20_000,
      });

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      aliceProxy.stop();
      bobProxy.stop();
      await second.close();
      try {
        fs.rmSync(bobDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('two app instances on git clones converge despite sync latency', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    // The user-reported setup: a git project, copy-pasted to a second folder
    // (clone), the second instance on a laggy connection.
    initRepositoryWithCommit({ repoDir: testProjectDir, message: 'base' });
    const bobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-bobclone-'));
    fs.cpSync(testProjectDir, bobDir, { recursive: true });

    const proxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp(bobDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, proxy.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: bobDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      const typed = 'one two three four five six seven eight nine ten';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      proxy.stop();
      await second.close();
      try {
        fs.rmSync(bobDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Known failure, kept as the reproduction: concurrent typing under latency
  // corrupts the converged text (contributions re-applied at stale bases,
  // carets thrown by whole-document replaces). The live-document redesign
  // (~/.claude/plans/live-document-unification-plan.md) must make this pass.
  test.fixme('both peers typing concurrently converge under sync latency', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    initRepositoryWithCommit({ repoDir: testProjectDir, message: 'base' });
    const bobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-bobclone-'));
    fs.cpSync(testProjectDir, bobDir, { recursive: true });

    const proxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp(bobDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, proxy.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: bobDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });
      // Joining swaps the editor to the shared document once the find over
      // the laggy network completes; typing before the swap lands in the
      // editor being replaced. Known gap, not this test's subject.
      await sleep(3_000);

      // Both type at the same time, in different places (concurrent inserts
      // at the very same position interleave by design — convergence over
      // intent): Alice at the end of the document, Bob at the heading's end.
      const aliceTyped = 'alpha bravo charlie delta echo';
      const bobTyped = 'uno dos tres cuatro cinco';
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      const docEndKey =
        os.platform() === 'darwin' ? 'Meta+ArrowDown' : 'Control+End';
      const docStartKey =
        os.platform() === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home';

      await aliceEditor.click();
      await window.keyboard.press(docEndKey);
      await bobEditor.click();
      await second.window.keyboard.press(docStartKey);
      await second.window.keyboard.press('End');

      await Promise.all([
        window.keyboard.type(` ${aliceTyped}`, { delay: 30 }),
        second.window.keyboard.type(` ${bobTyped}`, { delay: 30 }),
      ]);

      const tokens = [...aliceTyped.split(' '), ...bobTyped.split(' ')];

      // Every token from either side must end up at both, exactly once, and
      // both editors must converge to the same text.
      for (const token of tokens) {
        await expect(aliceEditor).toContainText(token, { timeout: 20_000 });
        await expect(bobEditor).toContainText(token, { timeout: 20_000 });
      }

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }

        if (sample === 9) {
          expect(bobText, 'both editors converge to the same text').toBe(
            aliceText
          );
        }
      }
    } finally {
      proxy.stop();
      await second.close();
      try {
        fs.rmSync(bobDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Known failure (kept as the reproduction): with sync latency, two
  // instances persisting the same file livelock through refresh — each sees
  // the other's write as an external edit and re-contributes it at a stale
  // base, duplicating tokens endlessly. Decision 2026-08-13: same-machine
  // same-folder setup is out of scope for now; unskip when that changes.
  test.fixme('two app instances on the same folder converge despite sync latency', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    // The second instance reaches the sync server through a delayed proxy,
    // like a peer on a real network. Its copy of the shared state lags, so
    // its persists can land older content in the shared file.
    const proxy = await startLatencyProxy({
      targetPort: syncServer.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareUrl = await shareCurrentDocument({ window });
    await closeShareDialog({ window });

    const second = await launchSecondApp(testProjectDir);
    try {
      await second.window.evaluate((url) => {
        localStorage.setItem('syncServiceUrl', url);
      }, proxy.url);

      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: second.projectDir,
      });
      await openHelloMd({ window: second.window });
      await joinSharedDocument({ window: second.window, shareUrl });

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = second.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      for (let sample = 0; sample < 10; sample += 1) {
        await sleep(500);

        const aliceText = (await aliceEditor.textContent()) ?? '';
        const bobText = (await bobEditor.textContent()) ?? '';

        for (const token of tokens) {
          expect(
            aliceText.split(token).length - 1,
            `token "${token}" must appear exactly once at Alice, got: ${JSON.stringify(aliceText)}`
          ).toBe(1);
          expect(
            bobText.split(token).length - 1,
            `token "${token}" must appear exactly once at Bob, got: ${JSON.stringify(bobText)}`
          ).toBe(1);
        }
      }
    } finally {
      proxy.stop();
      await second.close();
    }
  });
});
