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

// Checks many times over a few seconds: a feedback loop shows up as repeated
// tokens after the text first looked right.
export const expectEachTokenOnceOverTime = async ({
  editor,
  tokens,
  samples = 10,
  intervalMs = 500,
  alsoExpectPerSample,
}: {
  editor: Locator;
  tokens: string[];
  samples?: number;
  intervalMs?: number;
  alsoExpectPerSample?: () => void;
}) => {
  for (let sample = 0; sample < samples; sample += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const content = (await editor.textContent()) ?? '';
    for (const token of tokens) {
      expect(
        content.split(token).length - 1,
        `token "${token}" must appear exactly once, got: ${JSON.stringify(content)}`
      ).toBe(1);
    }

    alsoExpectPerSample?.();
  }
};
