import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectFileToContain,
  expectNoErrorNotification,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startSyncServer } from '../shared/sync-server';
import {
  expectShared,
  joinFromButton,
  launchApp,
  shareFromActionsBar,
} from './helpers';

test.describe('a shared document across a restart', () => {
  // Shared documents outlive the process, so typing made while the sync
  // service was out of reach is still there after a restart, and reaches the
  // sync service once it is back.
  test('keeps what was typed offline through a restart and syncs it once the sync service is back', async () => {
    test.setTimeout(180_000);

    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-userdata-restart-')
    );
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-restart-')
    );
    fs.writeFileSync(
      path.join(projectDir, 'hello.md'),
      '# Hello\n\nThis is a test document.\n'
    );
    const syncServiceDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-sync-restart-')
    );
    let syncService = await startSyncServer({ dataDir: syncServiceDataDir });

    try {
      const beforeRestart = await launchApp({
        userDataDir,
        projectDir,
        syncServiceUrl: syncService.url,
      });
      await openProjectFolder({
        electronApp: beforeRestart.app,
        window: beforeRestart.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: beforeRestart.window });
      const shareId = await shareFromActionsBar({
        window: beforeRestart.window,
      });

      // A guest can join before the sync service is stopped, so the share has
      // reached it.
      const earlyGuest = await launchApp({ syncServiceUrl: syncService.url });
      try {
        await joinFromButton({ window: earlyGuest.window, shareId });
        await expect(earlyGuest.window.locator('.ProseMirror')).toContainText(
          'This is a test document',
          { timeout: 20_000 }
        );
      } finally {
        await earlyGuest.close();
      }
      syncService.stop();

      await typeInEditorSlowly({
        window: beforeRestart.window,
        text: ' OFFLINE',
        delay: 30,
      });
      await expectFileToContain({
        filePath: path.join(projectDir, 'hello.md'),
        text: 'OFFLINE',
      });
      await beforeRestart.app.close();

      const afterRestart = await launchApp({
        userDataDir,
        projectDir,
        syncServiceUrl: syncService.url,
      });
      await openProjectFolder({
        electronApp: afterRestart.app,
        window: afterRestart.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: afterRestart.window });

      // After the restart, with the sync service still down, the document is still
      // shared. The app knows this without the sync service: trying to reach it
      // would take 10s, well past this check's short wait.
      await expectShared({ window: afterRestart.window });
      await expect(afterRestart.window.locator('.ProseMirror')).toContainText(
        'OFFLINE'
      );
      await expectNoErrorNotification({ window: afterRestart.window });

      syncService = await startSyncServer({
        port: syncService.port,
        dataDir: syncServiceDataDir,
      });

      // Someone joining now sees what was typed offline.
      const lateGuest = await launchApp({ syncServiceUrl: syncService.url });
      try {
        await joinFromButton({ window: lateGuest.window, shareId });
        await expect(lateGuest.window.locator('.ProseMirror')).toContainText(
          'OFFLINE',
          { timeout: 30_000 }
        );
      } finally {
        await lateGuest.close();
      }

      await afterRestart.app.close();
    } finally {
      syncService.stop();
      for (const dir of [userDataDir, projectDir, syncServiceDataDir]) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  });
});
