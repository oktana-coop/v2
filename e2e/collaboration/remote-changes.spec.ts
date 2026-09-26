import { next as Automerge } from '@automerge/automerge';
import { type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { connectPeer } from '../shared/sync-server';
import {
  expectTextOverTime,
  recordCoarseSyncApplies,
  shareFromCommandPalette,
  sleep,
} from './helpers';

// E.g. in the text node "This is a test document." with the caret after
// "test ", this returns "This is a test ".
const textBeforeCaretInNode = (window: Page) =>
  window.evaluate(() => {
    const selection = document.getSelection();
    if (!selection?.anchorNode) return null;
    return selection.anchorNode.textContent?.slice(0, selection.anchorOffset);
  });

test.describe('remote changes in the editor', () => {
  test.use({ withSyncServer: true });

  test('tokens written by a peer appear once and the document settles', async ({
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
      const tokens = ['red', 'orange', 'yellow', 'green', 'blue'];
      let text = peerHandle.fullDoc().content.trimEnd();
      for (const token of tokens) {
        text = `${text} ${token}`;
        peerHandle.change((doc) =>
          Automerge.updateText(doc, ['content'], `${text}\n`)
        );
        await sleep(200);
      }

      // The shared content also has to stay exactly as the peer wrote it.
      await expectTextOverTime({
        editor: aliceWindow.locator('.ProseMirror'),
        text: `HelloThis is a test document. ${tokens.join(' ')}`,
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).toBe(`${text}\n`),
      });

      // The synced text also reaches the sharer's disk.
      await expect
        .poll(
          () => fs.readFileSync(path.join(aliceProject, 'hello.md'), 'utf8'),
          { timeout: 10_000 }
        )
        .toContain('red orange yellow green blue');
    } finally {
      scriptedPeer.disconnect();
    }
  });

  test('a remote change on both sides of the caret leaves it in place', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    const coarseApplies = recordCoarseSyncApplies(aliceWindow);

    // Sets the DOM selection to put the caret at "This is a test |document.".
    // The locator matches on "This is a test", which the "Z" typed later
    // leaves intact.
    const paragraph = aliceWindow.locator('.ProseMirror p', {
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
      .poll(() => textBeforeCaretInNode(aliceWindow))
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

      const editor = aliceWindow.locator('.ProseMirror');
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
      await aliceWindow.keyboard.type('Z');
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

    // A scripted peer (as opposed to a second peer app) sends no changes, so a
    // duplicate can only come from Alice's editor.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      // Type like a person: fast enough that changes overlap with their own
      // sync round-trips.
      const typed = 'mercury venus earth mars jupiter';
      await typeInEditorSlowly({
        window: aliceWindow,
        text: ` ${typed}`,
        delay: 30,
      });

      // The scripted peer's copy also has to stay exactly as Alice typed it.
      await expectTextOverTime({
        editor: aliceWindow.locator('.ProseMirror'),
        text: `Hello ${typed}This is a test document.`,
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).toBe(
            `# Hello ${typed}\n\nThis is a test document.\n`
          ),
      });
    } finally {
      scriptedPeer.disconnect();
    }
  });
});
