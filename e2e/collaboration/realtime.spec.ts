import { next as Automerge } from '@automerge/automerge';
import { type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { initRepositoryWithCommit } from '../shared/git';
import {
  createAndSwitchToBranch,
  documentEndKey,
  documentStartKey,
  lineEndKey,
  openDocument,
  openHelloMd,
  openProjectFolder,
  switchToBranch,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  connectPeer,
  startLatencyProxy,
  startTcpListener,
} from '../shared/sync-server';
import {
  attemptJoinFromCommandPalette,
  expectEachTokenOnceOverTime,
  expectPeerAvatars,
  expectTextOverTime,
  joinFromButton,
  joinFromCommandPalette,
  launchApp,
  shareFromCommandPalette,
} from './helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Remote changes the editor could not apply as exact steps and applied
// coarsely instead, by replacing the whole changed region.
const recordCoarseSyncApplies = (window: Page): string[] => {
  const applies: string[] = [];
  window.on('console', (message) => {
    if (message.text().includes('Live sync fell back')) {
      applies.push(message.text());
    }
  });
  return applies;
};

// E.g. in the text node "This is a test document." with the caret after
// "test ", this returns "This is a test ".
const textBeforeCaretInNode = (window: Page) =>
  window.evaluate(() => {
    const selection = document.getSelection();
    if (!selection?.anchorNode) return null;
    return selection.anchorNode.textContent?.slice(0, selection.anchorOffset);
  });

test.describe('realtime collaboration', () => {
  test.use({ withSyncServer: true });

  // Private documents live in a repo with no network: nothing dials the
  // sync service until a document is shared or joined.
  test('a private document never dials the sync service', async () => {
    const syncService = await startTcpListener();

    const alice = await launchApp({ syncServiceUrl: syncService.url });
    try {
      await openProjectFolder({
        electronApp: alice.app,
        window: alice.window,
        folderPath: alice.projectDir,
      });
      await openHelloMd({ window: alice.window });
      await typeInEditorSlowly({
        window: alice.window,
        text: ' kept local',
        delay: 30,
      });

      await syncService.expectNoConnectionsAfterWaiting();
    } finally {
      await alice.close();
      syncService.stop();
    }
  });

  // Sharing switches the open document in place: nothing re-opens, so text
  // typed before, during, and after the transition all survives.
  test('typing through the share transition loses nothing', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    await typeInEditorSlowly({ window, text: ' before', delay: 30 });

    const shareId = await shareFromCommandPalette({ window });

    await typeInEditorSlowly({ window, text: ' after', delay: 30 });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('before after');

    // Someone joining sees everything, including what was typed before the share.
    const bob = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      await joinFromButton({ window: bob.window, shareId });
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'before after',
        { timeout: 20_000 }
      );
    } finally {
      await bob.close();
    }
  });

  test('tokens written by a peer appear once and the document settles', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

    // A scripted peer (as opposed to a second peer app), to control how the peer
    // sends its changes: one token at a time.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      expect(peerHandle.fullDoc().formatVersion).toBe(1);
      expect(peerHandle.fullDoc().content).toContain(
        'This is a test document.'
      );

      // Write like someone typing: one token at a time, replacing the full
      // text so updateText computes the splices.
      const tokens = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
      let text = peerHandle.fullDoc().content.trimEnd();
      for (const token of tokens) {
        text = `${text} ${token}`;
        peerHandle.change((doc) =>
          Automerge.updateText(doc, ['content'], `${text}\n`)
        );
        await sleep(200);
      }

      const editor = window.locator('.ProseMirror');
      await expect(editor).toContainText('alpha bravo charlie delta echo', {
        timeout: 15_000,
      });

      // The shared content also has to stay exactly as the peer wrote it.
      const expected = `${text}\n`;
      await expectEachTokenOnceOverTime({
        editor,
        tokens,
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).toBe(expected),
      });

      // The synced text also reaches the sharer's disk.
      await expect
        .poll(
          () => fs.readFileSync(path.join(aliceProject, 'hello.md'), 'utf8'),
          { timeout: 10_000 }
        )
        .toContain('alpha bravo charlie delta echo');
    } finally {
      scriptedPeer.disconnect();
    }
  });

  test('a remote change on both sides of the caret leaves it in place', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });
    const coarseApplies = recordCoarseSyncApplies(window);

    // Sets the DOM selection to put the caret at "This is a test |document.".
    // The locator matches on "This is a test", which the "Z" typed later
    // leaves intact.
    const paragraph = window.locator('.ProseMirror p', {
      hasText: 'This is a test',
    });
    await paragraph.click();
    await paragraph.evaluate((element) => {
      const selection = document.getSelection();
      const textNode = element.firstChild;
      if (!selection || !textNode) throw new Error('paragraph has no text');
      selection.collapse(textNode, 'This is a test '.length);
    });
    await expect
      .poll(() => textBeforeCaretInNode(window))
      .toBe('This is a test ');

    // A scripted peer (as opposed to a second peer app), to control the change the
    // peer sends: one, on both sides of the caret.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      // One change that edits the title before the caret's paragraph and
      // appends a paragraph after it.
      const content =
        '# Hello there\n\nThis is a test document.\n\nAppended by a peer.\n';
      peerHandle.change((doc) =>
        Automerge.updateText(doc, ['content'], content)
      );

      const editor = window.locator('.ProseMirror');
      await expect(editor).toContainText('Hello there', { timeout: 15_000 });
      await expect(editor).toContainText('Appended by a peer.', {
        timeout: 15_000,
      });
      await sleep(1_000);

      // A coarse apply would replace everything between the two edits, the
      // caret's paragraph included, and move the caret. A soft expectation, so
      // the test goes on to check the caret, and a failure reports both.
      expect.soft(coarseApplies).toEqual([]);
      expect(peerHandle.fullDoc().content).toBe(content);

      // Where a keystroke lands is the caret the editor really holds, focus
      // or no focus.
      await window.keyboard.type('Z');
      await expect(paragraph).toHaveText('This is a test Zdocument.');
      await expect(editor).toHaveText(
        'Hello thereThis is a test Zdocument.Appended by a peer.'
      );
    } finally {
      scriptedPeer.disconnect();
    }
  });

  test('typing in the editor does not duplicate text at the other peer', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

    // A scripted peer (as opposed to a second peer app) sends no changes, so a
    // duplicate can only come from Alice's editor.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      // Type like a person: fast enough that changes overlap with their own
      // sync round-trips.
      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const editor = window.locator('.ProseMirror');

      await expect
        .poll(() => peerHandle.fullDoc().content, { timeout: 15_000 })
        .toContain('five');

      // The scripted peer's copy also has to stay exactly as Alice typed it.
      await expectEachTokenOnceOverTime({
        editor,
        tokens,
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).toBe(
            `# Hello ${typed}\n\nThis is a test document.\n`
          ),
      });
    } finally {
      scriptedPeer.disconnect();
    }
  });

  test('two app instances converge without re-writing tokens', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

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
      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      await bob.close();
    }
  });

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
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

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
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

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

  test('two app instances on the same folder converge without re-writing tokens', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

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

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      await bob.close();
    }
  });

  test('two app instances on separate clones converge despite sync latency', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

    const bob = await launchApp({ syncServiceUrl: proxy.url });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bob.projectDir,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });

  // A share ID names the document it was made from, so joining opens this
  // project's copy of that document, no matter which document is open.
  test('a share for a document other than the open one opens that document', async ({
    syncServer,
    electronApp,
    window,
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
    const bobProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-bobclone-')
    );
    fs.cpSync(aliceProject, bobProject, { recursive: true });

    await openProjectFolder({ electronApp, window, folderPath: aliceProject });
    await openDocument({ window, relativePath: 'notes.md' });

    const shareId = await shareFromCommandPalette({ window });

    const bob = await launchApp({
      syncServiceUrl: syncServer!.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
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
      await typeInEditorSlowly({ window, text: ' and joined', delay: 30 });
      await expect(bobEditor).toContainText('and joined', { timeout: 20_000 });
    } finally {
      await bob.close();
      fs.rmSync(bobProject, { recursive: true, force: true });
    }
  });

  test('a share for a document this project does not have is refused', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Only Alice has this document. Bob's project is a different one.
    fs.writeFileSync(
      path.join(aliceProject, 'notes.md'),
      '# Notes\n\nAlice only.\n'
    );
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });

    await openProjectFolder({ electronApp, window, folderPath: aliceProject });
    await openDocument({ window, relativePath: 'notes.md' });

    const shareId = await shareFromCommandPalette({ window });

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
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Alice shares from a branch; Bob holds the same repository, on main.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await createAndSwitchToBranch({ window, branchName: 'draft' });
    await openHelloMd({ window });
    const shareId = await shareFromCommandPalette({ window });

    const bobProject = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-bob-'));
    fs.cpSync(aliceProject, bobProject, { recursive: true });

    const bob = await launchApp({
      syncServiceUrl: syncServer!.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
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
      await typeInEditorSlowly({ window, text: ' from draft', delay: 30 });
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'from draft',
        { timeout: 20_000 }
      );
    } finally {
      await bob.close();
      try {
        fs.rmSync(bobProject, { recursive: true, force: true });
      } catch {}
    }
  });

  test('typing into a shared title-only document converges without repeating any of the typed text', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // A document holding nothing but a title, open on both peers and shared
    // from one; a single word typed on the sharing side.
    fs.writeFileSync(path.join(aliceProject, 'Foo.md'), '# Foo\n');
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    const bobProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-bobclone-')
    );
    fs.cpSync(aliceProject, bobProject, { recursive: true });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openDocument({ window, relativePath: 'Foo.md' });

    const bob = await launchApp({
      syncServiceUrl: syncServer!.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
      });
      await openDocument({ window: bob.window, relativePath: 'Foo.md' });

      const shareId = await shareFromCommandPalette({ window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await typeInEditorSlowly({ window, text: 'lorem', delay: 40 });

      await expect(bobEditor).toContainText('lorem', { timeout: 20_000 });

      // A diff-feedback loop shows up as repeated fragments ("lorereremrem…").
      await Promise.all([
        expectTextOverTime({ editor: aliceEditor, text: 'Foolorem' }),
        expectTextOverTime({ editor: bobEditor, text: 'Foolorem' }),
      ]);
    } finally {
      await bob.close();
      try {
        fs.rmSync(bobProject, { recursive: true, force: true });
      } catch {}
    }
  });

  test('one peer typing with pauses converges when both peers are on laggy connections', async ({
    syncServer,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // Closest to a real session: git clones, both peers behind latency, and
    // typing with pauses long enough for persist and refresh cycles to run
    // between words.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    const bobProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-bobclone-')
    );
    fs.cpSync(aliceProject, bobProject, { recursive: true });

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

    const bob = await launchApp({
      syncServiceUrl: bobProxy.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

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
        await typeInEditorSlowly({
          window: alice.window,
          text: ` ${token}`,
          delay: 40,
        });
        await sleep(450);
      }

      const aliceEditor = alice.window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(tokens.join(' '), {
        timeout: 20_000,
      });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      aliceProxy.stop();
      bobProxy.stop();
      await bob.close();
      await alice.close();
      try {
        fs.rmSync(bobProject, { recursive: true, force: true });
      } catch {}
    }
  });

  test('two app instances on git clones converge despite sync latency', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // A git project copied to a second folder (a clone), with the second
    // instance on a laggy connection.
    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    const bobProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-bobclone-')
    );
    fs.cpSync(aliceProject, bobProject, { recursive: true });

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

    const bob = await launchApp({
      syncServiceUrl: proxy.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });

      const typed = 'one two three four five six seven eight nine ten';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
      try {
        fs.rmSync(bobProject, { recursive: true, force: true });
      } catch {}
    }
  });

  test('both peers typing concurrently converge under sync latency', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    initRepositoryWithCommit({ repoDir: aliceProject, message: 'base' });
    const bobProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-bobclone-')
    );
    fs.cpSync(aliceProject, bobProject, { recursive: true });

    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

    const bob = await launchApp({
      syncServiceUrl: proxy.url,
      projectDir: bobProject,
    });
    try {
      await openProjectFolder({
        electronApp: bob.app,
        window: bob.window,
        folderPath: bobProject,
      });
      await openHelloMd({ window: bob.window });
      await joinFromCommandPalette({ window: bob.window, shareId });
      // Joining swaps the editor to the shared document once the find over
      // the laggy network completes; typing before the swap lands in the
      // editor being replaced. Known gap, not this test's subject.
      await sleep(3_000);

      // The main scenario must ride the exact-steps path; a coarse apply here
      // means the region replace is still carrying it.
      const aliceCoarseApplies = recordCoarseSyncApplies(window);
      const bobCoarseApplies = recordCoarseSyncApplies(bob.window);

      // Both type at the same time, in different places (concurrent inserts
      // at the very same position interleave by design — convergence over
      // intent): Alice at the end of the document, Bob at the heading's end.
      const aliceTyped = 'alpha bravo charlie delta echo';
      const bobTyped = 'uno dos tres cuatro cinco';
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await aliceEditor.click();
      await window.keyboard.press(documentEndKey);
      await bobEditor.click();
      await bob.window.keyboard.press(documentStartKey);
      await bob.window.keyboard.press(lineEndKey);

      await Promise.all([
        window.keyboard.type(` ${aliceTyped}`, { delay: 30 }),
        bob.window.keyboard.type(` ${bobTyped}`, { delay: 30 }),
      ]);

      const tokens = [...aliceTyped.split(' '), ...bobTyped.split(' ')];

      // Every token from either side must end up at both, exactly once, and
      // both editors must converge to the same text.
      for (const token of tokens) {
        await expect(aliceEditor).toContainText(token, { timeout: 20_000 });
        await expect(bobEditor).toContainText(token, { timeout: 20_000 });
      }

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
      expect(
        await bobEditor.textContent(),
        'both editors converge to the same text'
      ).toBe(await aliceEditor.textContent());

      expect([...aliceCoarseApplies, ...bobCoarseApplies]).toEqual([]);
    } finally {
      proxy.stop();
      await bob.close();
      try {
        fs.rmSync(bobProject, { recursive: true, force: true });
      } catch {}
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
    window,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(180_000);

    // The second instance reaches the sync server through a delayed proxy,
    // like a peer on a real network. Its copy of the shared state lags, so
    // its persists can land older content in the shared file.
    const proxy = await startLatencyProxy({
      targetPort: syncServer!.port,
      delayMs: 200,
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: aliceProject,
    });
    await openHelloMd({ window });

    const shareId = await shareFromCommandPalette({ window });

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

      const typed = 'one two three four five';
      await typeInEditorSlowly({ window, text: ` ${typed}`, delay: 30 });

      const tokens = typed.split(' ');
      const aliceEditor = window.locator('.ProseMirror');
      const bobEditor = bob.window.locator('.ProseMirror');

      await expect(bobEditor).toContainText(typed, { timeout: 20_000 });

      await Promise.all([
        expectEachTokenOnceOverTime({ editor: aliceEditor, tokens }),
        expectEachTokenOnceOverTime({ editor: bobEditor, tokens }),
      ]);
    } finally {
      proxy.stop();
      await bob.close();
    }
  });
});
