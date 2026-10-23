import { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  mockCreateFileWithDialog,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
} from '../shared/helpers';

const exportToDocx = async ({
  electronApp,
  window,
  docxOutputPath,
}: {
  electronApp: ElectronApplication;
  window: Page;
  docxOutputPath: string;
}) => {
  await mockCreateFileWithDialog({ electronApp, filePath: docxOutputPath });

  await openCommandPalette({ window });

  const exportDocxOption = window.getByText('Export to Docx (Microsoft Word)');
  await exportDocxOption.waitFor({ state: 'visible', timeout: 2_000 });
  await exportDocxOption.click();

  // Wait for the DOCX file to be written to disk
  const deadline = Date.now() + 15_000;
  while (
    !(fs.existsSync(docxOutputPath) && fs.statSync(docxOutputPath).size > 0) &&
    Date.now() < deadline
  ) {
    await window.waitForTimeout(500);
  }
};

test('export to DOCX produces a valid DOCX file', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  const docxOutputPath = path.join(
    os.tmpdir(),
    `v2-e2e-docx-${Date.now()}.docx`
  );
  await exportToDocx({ electronApp, window, docxOutputPath });

  expect(fs.existsSync(docxOutputPath)).toBe(true);

  // A DOCX file is a zip archive, which starts with "PK", and its document is
  // the `word/document.xml` entry. Entry names are stored as plain text.
  const docx = fs.readFileSync(docxOutputPath);
  expect(docx.subarray(0, 2).toString('ascii')).toBe('PK');
  expect(docx.includes('word/document.xml')).toBe(true);

  try {
    fs.unlinkSync(docxOutputPath);
  } catch {}
});
