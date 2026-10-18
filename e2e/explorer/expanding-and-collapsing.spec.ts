import { type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectCurrentProject,
  navigateToEdit,
  navigateToProjectHistory,
  openProjectFolder,
} from '../shared/helpers';

const fileExplorer = ({ window }: { window: Page }) =>
  window.getByTestId('file-explorer');

const toggleFolder = async ({
  window,
  name,
}: {
  window: Page;
  name: string;
}): Promise<void> => {
  await fileExplorer({ window }).getByText(name, { exact: true }).click();
};

const expectAlphaFolderCollapsed = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  const explorer = fileExplorer({ window });

  await expect(explorer.getByText('alpha-folder')).toBeVisible();
  await expect(explorer.getByText('notes', { exact: true })).toBeHidden();
  await expect(explorer.getByText('nested-note.md')).toBeHidden();
};

const expectAlphaFolderExpanded = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  const explorer = fileExplorer({ window });

  await expect(explorer.getByText('notes', { exact: true })).toBeVisible();
  await expect(explorer.getByText('nested-note.md')).toBeVisible();
};

test.describe('expanding and collapsing folders', () => {
  test('collapsing a folder hides its children', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await expectAlphaFolderExpanded({ window });

    await toggleFolder({ window, name: 'alpha-folder' });

    await expectAlphaFolderCollapsed({ window });
  });

  test('expanding a collapsed folder reveals its children', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });

    await toggleFolder({ window, name: 'alpha-folder' });

    await expectAlphaFolderExpanded({ window });
  });
});

test.describe('remembering expanded and collapsed folders', () => {
  test('a collapsed folder stays collapsed after visiting project history', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });

    await navigateToProjectHistory({ window });
    await navigateToEdit({ window });

    await expectAlphaFolderCollapsed({ window });
    await expect(
      fileExplorer({ window }).getByText('beta-doc.md')
    ).toBeVisible();
  });

  test('a folder expanded again stays expanded after visiting project history', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderExpanded({ window });

    await navigateToProjectHistory({ window });
    await navigateToEdit({ window });

    await expectAlphaFolderExpanded({ window });
  });

  test('a collapsed folder stays collapsed after a reload', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });

    await window.reload();

    await expectCurrentProject({ window, directory: nestedProjectDir });
    await expectAlphaFolderCollapsed({ window });
  });

  test('lists what changed outside the app while away, keeping a collapsed folder collapsed', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });

    await navigateToProjectHistory({ window });
    fs.rmSync(path.join(nestedProjectDir, 'beta-folder'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(nestedProjectDir, 'delta-folder'));
    fs.writeFileSync(
      path.join(nestedProjectDir, 'delta-folder', 'delta-doc.md'),
      '# Delta Doc\n'
    );
    await navigateToEdit({ window });

    const explorer = fileExplorer({ window });
    await expect(explorer.getByText('delta-doc.md')).toBeVisible();
    await expect(explorer.getByText('beta-folder')).toBeHidden();
    await expectAlphaFolderCollapsed({ window });
  });

  test('each project keeps its own collapsed folders', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    const otherProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-nested-other-')
    );
    fs.cpSync(nestedProjectDir, otherProjectDir, { recursive: true });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await toggleFolder({ window, name: 'alpha-folder' });
    await expectAlphaFolderCollapsed({ window });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: otherProjectDir,
    });
    await expectCurrentProject({ window, directory: otherProjectDir });
    await expectAlphaFolderExpanded({ window });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });
    await expectCurrentProject({ window, directory: nestedProjectDir });
    await expectAlphaFolderCollapsed({ window });

    try {
      fs.rmSync(otherProjectDir, { recursive: true, force: true });
    } catch {}
  });
});
