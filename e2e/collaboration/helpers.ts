import {
  type AutomergeUrl,
  parseAutomergeUrl,
} from '@automerge/automerge-repo';
import {
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, launchElectronApp } from '../shared/fixtures';
import { openCommandPalette } from '../shared/helpers';
import { type SyncServer } from '../shared/sync-server';

// Another app instance with its own user data, like a separate machine. It
// comes with a new project folder holding hello.md unless given one.
export const launchApp = async ({
  syncServiceUrl,
  userDataDir: userDataDirInput,
  projectDir: projectDirInput,
}: {
  syncServiceUrl: string;
  userDataDir?: string;
  projectDir?: string;
}): Promise<{
  app: ElectronApplication;
  window: Page;
  projectDir: string;
  close: () => Promise<void>;
}> => {
  const userDataDir =
    userDataDirInput ??
    fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-userdata-peer-'));
  const projectDir = projectDirInput ?? createHelloProject();

  const app = await launchElectronApp({ userDataDir, syncServiceUrl });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Passed-in dirs outlive this app, so we don't consider them created.
  const created = [
    ...(userDataDirInput ? [] : [userDataDir]),
    ...(projectDirInput ? [] : [projectDir]),
  ];

  return {
    app,
    window,
    projectDir,
    close: async () => {
      await app.close();
      for (const dir of created) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    },
  };
};

const createHelloProject = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-peer-'));
  fs.writeFileSync(
    path.join(dir, 'hello.md'),
    '# Hello\n\nThis is a test document.\n'
  );
  return dir;
};

// Another app instance on a copy of `source`, git history included, like a
// clone on another machine.
export const cloneAndLaunchApp = async ({
  syncServiceUrl,
  source,
}: {
  syncServiceUrl: string;
  source: string;
}) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-clone-'));
  fs.cpSync(source, projectDir, { recursive: true });
  const peer = await launchApp({ syncServiceUrl, projectDir });

  return {
    ...peer,
    close: async () => {
      await peer.close();
      try {
        fs.rmSync(projectDir, { recursive: true, force: true });
      } catch {}
    },
  };
};

// The share button in the editor's actions bar: it reads as "Share Document"
// while the document is private and "Sharing Options" once it is shared.
export const shareButton = (window: Page) =>
  window.getByRole('button', { name: /Share Document|Sharing Options/ });

export const expectPrivate = async ({ window }: { window: Page }) => {
  await expect(
    window.getByRole('button', { name: 'Share Document' })
  ).toBeVisible();
};

export const expectShared = async ({ window }: { window: Page }) => {
  await expect(
    window.getByRole('button', { name: 'Sharing Options' })
  ).toBeVisible();
};

export const closeShareDialog = async ({ window }: { window: Page }) => {
  const close = window.getByRole('button', { name: 'Close' });
  await close.click();
  await close.waitFor({ state: 'hidden', timeout: 5_000 });
};

const createShareId = async ({ window }: { window: Page }): Promise<string> => {
  await window.getByRole('button', { name: 'Create share ID' }).click();

  const shown = window.getByTestId('share-id');
  await shown.waitFor({ state: 'visible', timeout: 10_000 });
  const shareId = await shown.textContent();
  expect(shareId).toMatch(/^automerge:/);

  await closeShareDialog({ window });

  return shareId as string;
};

export const shareFromActionsBar = async ({
  window,
}: {
  window: Page;
}): Promise<string> => {
  await shareButton(window).click();
  return createShareId({ window });
};

export const shareFromCommandPalette = async ({
  window,
}: {
  window: Page;
}): Promise<string> => {
  await openCommandPalette({ window });

  const shareOption = window.getByRole('option', {
    name: 'Share this document',
  });
  await shareOption.waitFor({ state: 'visible', timeout: 2_000 });
  await shareOption.click();

  return createShareId({ window });
};

export const stopSharingFromActionsBar = async ({
  window,
}: {
  window: Page;
}) => {
  await shareButton(window).click();
  await window.getByRole('button', { name: 'Stop sharing' }).click();
  await window
    .getByRole('button', { name: 'Stop sharing' })
    .waitFor({ state: 'hidden', timeout: 10_000 });
};

// Leaves the shared document a guest has open, back to where they can join.
export const leaveFromActionsBar = async ({ window }: { window: Page }) => {
  await shareButton(window).click();
  await window
    .getByRole('dialog')
    .getByRole('button', { name: 'Leave' })
    .click();
  await expect(
    window.getByRole('button', { name: 'Join shared document' }).first()
  ).toBeVisible({ timeout: 10_000 });
};

// The entries in a guest's "Shared with me" list.
export const guestShares = (window: Page) => window.getByTestId('guest-share');

// Submits the share ID without waiting for the join to succeed, since a share
// this project cannot join is refused inside the dialog, which stays open.
const submitShareId = async ({
  window,
  shareId,
}: {
  window: Page;
  shareId: string;
}) => {
  await expect(
    window
      .getByRole('dialog', { name: 'Join Shared Document' })
      .getByTestId('dialog-panel')
  )
    // Submitting before the dialog has faded in can leave it stuck open and
    // invisible, blocking clicks.
    .toHaveCSS('opacity', '1');

  const input = window.getByPlaceholder('Share ID');
  await input.fill(shareId);
  await input.press('Enter');

  return input;
};

// The "Join shared document" button of the start screens.
export const joinFromButton = async ({
  window,
  shareId,
}: {
  window: Page;
  shareId: string;
}) => {
  await window
    .getByRole('button', { name: 'Join shared document' })
    .first()
    .click();
  return submitShareId({ window, shareId });
};

export const attemptJoinFromCommandPalette = async ({
  window,
  shareId,
}: {
  window: Page;
  shareId: string;
}) => {
  await openCommandPalette({ window });

  const joinOption = window.getByRole('option', {
    name: 'Join shared document',
  });
  await joinOption.waitFor({ state: 'visible', timeout: 2_000 });
  await joinOption.click();

  return submitShareId({ window, shareId });
};

export const joinFromCommandPalette = async ({
  window,
  shareId,
}: {
  window: Page;
  shareId: string;
}) => {
  const input = await attemptJoinFromCommandPalette({ window, shareId });
  await input.waitFor({ state: 'hidden', timeout: 10_000 });
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Remote changes the editor could not apply as exact steps and applied
// coarsely instead, by replacing the whole changed region.
export const recordCoarseSyncApplies = (window: Page): string[] => {
  const applies: string[] = [];
  window.on('console', (message) => {
    if (message.text().includes('Live sync fell back')) {
      applies.push(message.text());
    }
  });
  return applies;
};

type Sampling = {
  initialCheckTimeoutMs?: number;
  samples?: number;
  intervalMs?: number;
};

// Waits until the check first passes, then keeps checking over a few seconds:
// a feedback loop shows up only after the text first looked right.
const expectOverTime = async ({
  check,
  initialCheckTimeoutMs = 20_000,
  samples = 10,
  intervalMs = 500,
}: Sampling & { check: () => Promise<void> }) => {
  await expect(check).toPass({ timeout: initialCheckTimeoutMs });

  for (let sample = 0; sample < samples; sample += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    await check();
  }
};

export const expectTextOverTime = ({
  editor,
  text,
  alsoExpectPerSample,
  ...sampling
}: Sampling & {
  editor: Locator;
  text: string;
  alsoExpectPerSample?: () => void;
}) =>
  expectOverTime({
    ...sampling,
    check: async () => {
      expect(await editor.textContent()).toBe(text);
      alsoExpectPerSample?.();
    },
  });

// The sync server holds the documents of the given shares and nothing else.
export const expectSyncServerToHoldOnlyOverTime = ({
  syncServer,
  shareIds,
  alsoExpectPerSample,
  ...sampling
}: Sampling & {
  syncServer: SyncServer;
  shareIds: string[];
  alsoExpectPerSample?: () => void;
}) => {
  const expected = shareIds
    .map((shareId) => parseAutomergeUrl(shareId as AutomergeUrl).documentId)
    .sort();

  return expectOverTime({
    ...sampling,
    check: async () => {
      expect(syncServer.storedDocumentIds().sort()).toEqual(expected);
      alsoExpectPerSample?.();
    },
  });
};

// The avatars of the other peers in the actions bar.
export const expectPeerAvatars = async ({
  window,
  count,
}: {
  window: Page;
  count: number;
}) => {
  await expect(window.getByTestId('presence-avatar')).toHaveCount(count, {
    timeout: 20_000,
  });
};
