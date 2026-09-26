import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectNoErrorNotification,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startSyncServer } from '../shared/sync-server';
import { joinFromButton, launchApp, shareFromActionsBar } from './helpers';

test.describe('a shared document across a restart', () => {
  // Shared documents outlive the process, so typing made while the service
  // was out of reach is still there after a restart, and reaches the
  // service once it is back.
  test('reopens from local storage while the service is unreachable, and syncs what was typed offline once it is back', async () => {
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
    const serviceDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-sync-restart-')
    );
    let service = await startSyncServer({ dataDir: serviceDataDir });

    try {
      const first = await launchApp({
        userDataDir,
        projectDir,
        syncServiceUrl: service.url,
      });
      await openProjectFolder({
        electronApp: first.app,
        window: first.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: first.window });
      const shareId = await shareFromActionsBar({ window: first.window });

      // The share reaches the service before the service goes away.
      const earlyGuest = await launchApp({ syncServiceUrl: service.url });
      try {
        await joinFromButton({ window: earlyGuest.window, shareId });
        await expect(earlyGuest.window.locator('.ProseMirror')).toContainText(
          'This is a test document',
          { timeout: 20_000 }
        );
      } finally {
        await earlyGuest.close();
      }
      service.stop();

      await typeInEditorSlowly({
        window: first.window,
        text: ' OFFLINE',
        delay: 30,
      });
      await expect
        .poll(
          () => fs.readFileSync(path.join(projectDir, 'hello.md'), 'utf8'),
          {
            timeout: 10_000,
          }
        )
        .toContain('OFFLINE');
      await first.app.close();

      const second = await launchApp({
        userDataDir,
        projectDir,
        syncServiceUrl: service.url,
      });
      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: second.window });

      // Found in local storage, the document opens shared at once. Asking
      // the unreachable service instead would take its 10 s timeout and
      // open the document without sharing.
      await expect(
        second.window.getByRole('button', { name: 'Sharing Options' })
      ).toBeVisible({ timeout: 8_000 });
      await expect(second.window.locator('.ProseMirror')).toContainText(
        'OFFLINE'
      );
      await expectNoErrorNotification({ window: second.window });

      service = await startSyncServer({
        port: service.port,
        dataDir: serviceDataDir,
      });
      // Someone joining now sees what was typed offline.
      const lateGuest = await launchApp({ syncServiceUrl: service.url });
      try {
        await joinFromButton({ window: lateGuest.window, shareId });
        await expect(lateGuest.window.locator('.ProseMirror')).toContainText(
          'OFFLINE',
          { timeout: 30_000 }
        );
      } finally {
        await lateGuest.close();
      }

      await second.app.close();
    } finally {
      service.stop();
      for (const dir of [userDataDir, projectDir, serviceDataDir]) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  });
});
