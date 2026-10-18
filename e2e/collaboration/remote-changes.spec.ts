import { next as Automerge } from '@automerge/automerge';
import { type Page } from '@playwright/test';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectFileToContain,
  moveToEndOfFirstPlainTextLine,
  openHelloMd,
  openPlainTextDocument,
  openProjectFolder,
  plainTextEditor,
  plainTextEditorLines,
  typeInRichTextEditorSlowly,
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

test.describe('remote changes in the rich-text editor', () => {
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
    await syncServer!.waitForShare(shareId);

    // A scripted peer (as opposed to a second peer app), to control how the peer
    // sends its changes: one token at a time.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      expect(peerHandle.fullDoc().kind).toBe('RICH_TEXT_DOCUMENT');
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
      await expectFileToContain({
        filePath: path.join(aliceProject, 'hello.md'),
        text: tokens.join(' '),
      });
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
    await syncServer!.waitForShare(shareId);
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
    await syncServer!.waitForShare(shareId);

    // A scripted peer (as opposed to a second peer app) sends no changes, so a
    // duplicate can only come from Alice's editor.
    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      // Type like a person: fast enough that changes overlap with their own
      // sync round-trips.
      const typed = 'mercury venus earth mars jupiter';
      await typeInRichTextEditorSlowly({
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

test.describe('remote changes in the plain-text editor', () => {
  test.use({ withSyncServer: true });

  test("a peer's edits on both sides of the caret appear in place, with the caret where it was", async ({
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
    await openPlainTextDocument({ window: aliceWindow, name: 'config.json' });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    await moveToEndOfFirstPlainTextLine({ window: aliceWindow });

    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      peerHandle.change((doc) =>
        Automerge.updateText(
          doc,
          ['content'],
          '[\n{ "key": "value" }\n{ "from": "a peer" }\n]\n'
        )
      );

      await expect
        .poll(
          () => plainTextEditorLines({ window: aliceWindow }).allTextContents(),
          { timeout: 10_000 }
        )
        .toEqual(['[', '{ "key": "value" }', '{ "from": "a peer" }', ']', '']);

      await aliceWindow.keyboard.type(' typed');

      await expect
        .poll(() => peerHandle.fullDoc().content, { timeout: 10_000 })
        .toBe('[\n{ "key": "value" } typed\n{ "from": "a peer" }\n]\n');
      await expectFileToContain({
        filePath: path.join(aliceProject, 'config.json'),
        text: '{ "from": "a peer" }',
      });
    } finally {
      scriptedPeer.disconnect();
    }
  });

  test('typing while a peer writes elsewhere keeps both, each once', async ({
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
    await openPlainTextDocument({ window: aliceWindow, name: 'config.json' });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });
    await syncServer!.waitForShare(shareId);

    await moveToEndOfFirstPlainTextLine({ window: aliceWindow });

    const scriptedPeer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await scriptedPeer.findDocument(shareId);

      // The peer adds a line at the end, one token at a time, from the text
      // it holds then, so what Alice typed meanwhile is part of it.
      const tokens = ['red', 'orange', 'yellow', 'green', 'blue'];
      const writeAsPeer = async () => {
        for (const token of tokens) {
          const text = `${peerHandle.fullDoc().content}${token}\n`;
          peerHandle.change((doc) =>
            Automerge.updateText(doc, ['content'], text)
          );
          await sleep(200);
        }
      };

      // Alice types on the first line at the same time, fast enough that her
      // changes overlap with the peer's and with their own sync round-trips.
      const typed = ' mercury venus earth mars';
      await Promise.all([
        aliceWindow.keyboard.type(typed, { delay: 30 }),
        writeAsPeer(),
      ]);

      const expected = `{ "key": "value" }${typed}\n${tokens.map((token) => `${token}\n`).join('')}`;

      // The editor's lines run together, as the rest of the suite compares
      // editor text; the peer's copy keeps its line breaks.
      await expectTextOverTime({
        editor: plainTextEditor({ window: aliceWindow }),
        text: `{ "key": "value" }${typed}${tokens.join('')}`,
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).toBe(expected),
      });
      await expectFileToContain({
        filePath: path.join(aliceProject, 'config.json'),
        text: expected,
      });
    } finally {
      scriptedPeer.disconnect();
    }
  });
});
