import { next as Automerge } from '@automerge/automerge';
import { type DocHandle } from '@automerge/automerge-repo';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectCurrentProject,
  expectFileToContain,
  openDocumentExpectingContent,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { connectPeer, type DocumentContent } from '../shared/sync-server';
import {
  expectPrivate,
  expectShared,
  expectSyncServerToHoldOnlyOverTime,
  expectTextOverTime,
  shareFromActionsBar,
  stopSharingFromActionsBar,
} from './helpers';

const expectShareToContain = ({
  handle,
  text,
}: {
  handle: DocHandle<DocumentContent>;
  text: string;
}) =>
  expect
    .poll(() => handle.fullDoc().content, { timeout: 20_000 })
    .toContain(text);

// Private and shared documents live in separate Automerge repos. Once the
// synced repo is connected, nothing of the private repo may reach it.
test.describe('private documents alongside shared ones', () => {
  test.use({ withSyncServer: true });

  test('while one document is shared, the others stay off the sync service', async ({
    syncServer,
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
    const shareId = await shareFromActionsBar({ window });

    await openDocumentExpectingContent({
      window,
      relativePath: 'world.md',
      content: 'Another document.',
    });
    await expectPrivate({ window });
    await typeInEditorSlowly({ window, text: ' kept local', delay: 30 });
    await expectFileToContain({
      filePath: path.join(testProjectDir, 'world.md'),
      text: 'kept local',
    });

    await expectSyncServerToHoldOnlyOverTime({
      syncServer: syncServer!,
      shareIds: [shareId],
    });
  });

  test('text typed after stopping sharing stays off the sync service', async ({
    syncServer,
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
    const shareId = await shareFromActionsBar({ window });
    await syncServer!.waitForShare(shareId);
    await typeInEditorSlowly({ window, text: ' shared', delay: 30 });

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);
      await expect
        .poll(() => peerHandle.fullDoc().content, { timeout: 20_000 })
        .toContain('shared');

      await stopSharingFromActionsBar({ window });
      await expectPrivate({ window });
      await typeInEditorSlowly({ window, text: ' kept local', delay: 30 });
      await expectFileToContain({
        filePath: path.join(testProjectDir, 'hello.md'),
        text: 'kept local',
      });

      await expectSyncServerToHoldOnlyOverTime({
        syncServer: syncServer!,
        shareIds: [shareId],
        alsoExpectPerSample: () =>
          expect(peerHandle.fullDoc().content).not.toContain('kept local'),
      });
    } finally {
      peer.disconnect();
    }
  });

  test("a peer's edits after sharing stops do not reach the document", async ({
    syncServer,
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
    const shareId = await shareFromActionsBar({ window });
    await syncServer!.waitForShare(shareId);

    const peer = connectPeer(syncServer!.url);
    // A second client of the sync server, to confirm the peer's edit reached it.
    const observer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);

      await stopSharingFromActionsBar({ window });
      await expectPrivate({ window });

      peerHandle.change((doc) =>
        Automerge.updateText(
          doc,
          ['content'],
          `${doc.content.trimEnd()} from the peer\n`
        )
      );
      const observerHandle = await observer.findDocument(shareId);
      await expect
        .poll(() => observerHandle.fullDoc().content, { timeout: 20_000 })
        .toContain('from the peer');

      const helloPath = path.join(testProjectDir, 'hello.md');
      await expectTextOverTime({
        editor: window.locator('.ProseMirror'),
        text: 'HelloThis is a test document.',
        alsoExpectPerSample: () =>
          expect(fs.readFileSync(helloPath, 'utf8')).not.toContain(
            'from the peer'
          ),
      });
    } finally {
      peer.disconnect();
      observer.disconnect();
    }
  });

  test('moving between a shared and a private document keeps each where it belongs', async ({
    syncServer,
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
    const shareId = await shareFromActionsBar({ window });
    await syncServer!.waitForShare(shareId);

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);
      const worldPath = path.join(testProjectDir, 'world.md');

      await openDocumentExpectingContent({
        window,
        relativePath: 'world.md',
        content: 'Another document.',
      });
      await expectPrivate({ window });
      await typeInEditorSlowly({ window, text: ' first visit', delay: 30 });
      await expectFileToContain({ filePath: worldPath, text: 'first visit' });

      await openDocumentExpectingContent({
        window,
        relativePath: 'hello.md',
        content: 'This is a test document.',
      });
      await expectShared({ window });
      await typeInEditorSlowly({ window, text: ' back in hello', delay: 30 });
      await expectShareToContain({ handle: peerHandle, text: 'back in hello' });

      await openDocumentExpectingContent({
        window,
        relativePath: 'world.md',
        content: 'first visit',
      });
      await expectPrivate({ window });
      await typeInEditorSlowly({ window, text: ' second visit', delay: 30 });
      await expectFileToContain({ filePath: worldPath, text: 'second visit' });

      await expectSyncServerToHoldOnlyOverTime({
        syncServer: syncServer!,
        shareIds: [shareId],
        alsoExpectPerSample: () => {
          const shared = peerHandle.fullDoc().content;
          expect(shared).not.toContain('first visit');
          expect(shared).not.toContain('second visit');
          expect(fs.readFileSync(worldPath, 'utf8')).not.toContain(
            'back in hello'
          );
        },
      });
    } finally {
      peer.disconnect();
    }
  });

  test('switching to a clone of a project with a shared document keeps the clone private', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir: firstProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: firstProject,
    });
    // Copied once opened, so it carries the same git history and document IDs.
    const secondProject = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-clone-')
    );
    fs.cpSync(firstProject, secondProject, { recursive: true });

    await openHelloMd({ window });
    const shareId = await shareFromActionsBar({ window });
    await syncServer!.waitForShare(shareId);

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);
      const firstHello = path.join(firstProject, 'hello.md');
      const secondHello = path.join(secondProject, 'hello.md');

      await openProjectFolder({
        electronApp,
        window,
        folderPath: secondProject,
      });
      await expectCurrentProject({ window, directory: secondProject });
      await openDocumentExpectingContent({
        window,
        relativePath: 'hello.md',
        content: 'This is a test document.',
      });
      await expectPrivate({ window });
      await typeInEditorSlowly({ window, text: ' in the clone', delay: 30 });
      await expectFileToContain({
        filePath: secondHello,
        text: 'in the clone',
      });

      await openProjectFolder({
        electronApp,
        window,
        folderPath: firstProject,
      });
      await expectCurrentProject({ window, directory: firstProject });
      await openDocumentExpectingContent({
        window,
        relativePath: 'hello.md',
        content: 'This is a test document.',
      });
      await expectShared({ window });
      await typeInEditorSlowly({ window, text: ' in the original', delay: 30 });
      await expectShareToContain({
        handle: peerHandle,
        text: 'in the original',
      });

      await expectSyncServerToHoldOnlyOverTime({
        syncServer: syncServer!,
        shareIds: [shareId],
        alsoExpectPerSample: () => {
          expect(peerHandle.fullDoc().content).not.toContain('in the clone');
          expect(fs.readFileSync(firstHello, 'utf8')).not.toContain(
            'in the clone'
          );
          expect(fs.readFileSync(secondHello, 'utf8')).not.toContain(
            'in the original'
          );
        },
      });
    } finally {
      peer.disconnect();
      try {
        fs.rmSync(secondProject, { recursive: true, force: true });
      } catch {}
    }
  });
});
