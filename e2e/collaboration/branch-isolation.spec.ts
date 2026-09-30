import { next as Automerge } from '@automerge/automerge';
import { type DocHandle } from '@automerge/automerge-repo';
import { type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { switchBranch } from '../shared/git';
import {
  commitChanges,
  createAndSwitchToBranch,
  expectFileToContain,
  openHelloMd,
  openProjectFolder,
  switchToBranch,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  connectPeer,
  type DocumentContent,
  type SyncServer,
} from '../shared/sync-server';
import {
  expectPrivate,
  expectTextOverTime,
  shareFromActionsBar,
} from './helpers';

const privateDraftOnlyText = 'only on the private draft';

// Everything the share has ever held, as the peer sees it.
const shareHistoryContents = ({
  handle,
}: {
  handle: DocHandle<DocumentContent>;
}) =>
  Automerge.getHistory(handle.fullDoc())
    .map(({ snapshot }) => snapshot.content)
    .join('\n');

// Commits text to hello.md on a private branch that main never had, then
// shares hello.md from main.
const commitPrivateDraftAndShareOnMain = async ({
  electronApp,
  window,
  testProjectDir,
  syncServer,
}: {
  electronApp: ElectronApplication;
  window: Page;
  testProjectDir: string;
  syncServer: SyncServer;
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });
  await createAndSwitchToBranch({ window, branchName: 'private-draft' });
  await typeInEditorSlowly({
    window,
    text: ` ${privateDraftOnlyText}`,
    delay: 30,
  });
  await expectFileToContain({
    filePath: path.join(testProjectDir, 'hello.md'),
    text: privateDraftOnlyText,
  });
  await commitChanges({ window, message: 'Private draft' });
  await switchToBranch({ window, from: 'private-draft', to: 'main' });
  await expect(window.locator('.ProseMirror')).not.toContainText(
    privateDraftOnlyText
  );

  const shareId = await shareFromActionsBar({ window });
  await syncServer.waitForShare(shareId);

  return shareId;
};

// A share belongs to one branch of a document.
test.describe('branch isolation of a shared document', () => {
  test.use({ withSyncServer: true });

  test('switching to a private branch in the app shares none of its text', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    const shareId = await commitPrivateDraftAndShareOnMain({
      electronApp,
      window,
      testProjectDir,
      syncServer: syncServer!,
    });

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);

      await switchToBranch({ window, to: 'private-draft' });
      await expectPrivate({ window });

      await expectTextOverTime({
        editor: window.locator('.ProseMirror'),
        text: `Hello ${privateDraftOnlyText}This is a test document.`,
        alsoExpectPerSample: () =>
          expect(shareHistoryContents({ handle: peerHandle })).not.toContain(
            privateDraftOnlyText
          ),
      });
    } finally {
      peer.disconnect();
    }
  });

  test('switching to a private branch outside the app shares none of its text', async ({
    syncServer,
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    const shareId = await commitPrivateDraftAndShareOnMain({
      electronApp,
      window,
      testProjectDir,
      syncServer: syncServer!,
    });
    const helloPath = path.join(testProjectDir, 'hello.md');

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);

      switchBranch({ repoDir: testProjectDir, branch: 'private-draft' });
      await expectFileToContain({
        filePath: helloPath,
        text: privateDraftOnlyText,
      });

      await expectTextOverTime({
        editor: window.locator('.ProseMirror'),
        text: 'HelloThis is a test document.',
        alsoExpectPerSample: () =>
          expect(shareHistoryContents({ handle: peerHandle })).not.toContain(
            privateDraftOnlyText
          ),
      });

      // Back on the shared branch an outside edit still reaches the peer, so
      // the file was being followed all along.
      switchBranch({ repoDir: testProjectDir, branch: 'main' });
      fs.appendFileSync(helloPath, '\nedited outside\n');
      await expect
        .poll(() => peerHandle.fullDoc().content, { timeout: 20_000 })
        .toContain('edited outside');
      expect(shareHistoryContents({ handle: peerHandle })).not.toContain(
        privateDraftOnlyText
      );
    } finally {
      peer.disconnect();
    }
  });

  test("a peer's change does not reach the private branch's file", async ({
    syncServer,
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    const shareId = await commitPrivateDraftAndShareOnMain({
      electronApp,
      window,
      testProjectDir,
      syncServer: syncServer!,
    });
    const helloPath = path.join(testProjectDir, 'hello.md');

    const peer = connectPeer(syncServer!.url);
    try {
      const peerHandle = await peer.findDocument(shareId);

      switchBranch({ repoDir: testProjectDir, branch: 'private-draft' });
      await expectFileToContain({
        filePath: helloPath,
        text: privateDraftOnlyText,
      });
      const fileOnPrivateDraft = fs.readFileSync(helloPath, 'utf8');

      peerHandle.change((doc) =>
        Automerge.updateText(
          doc,
          ['content'],
          `${doc.content.trimEnd()}\n\nfrom the peer\n`
        )
      );

      await expectTextOverTime({
        editor: window.locator('.ProseMirror'),
        text: 'HelloThis is a test document.from the peer',
        alsoExpectPerSample: () =>
          expect(fs.readFileSync(helloPath, 'utf8')).toBe(fileOnPrivateDraft),
      });
    } finally {
      peer.disconnect();
    }
  });
});
