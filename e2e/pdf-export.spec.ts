import { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from './shared/fixtures';
import {
  mockCreateNewFile,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
} from './shared/helpers';

const exportToPdf = async ({
  electronApp,
  window,
  pdfOutputPath,
}: {
  electronApp: ElectronApplication;
  window: Page;
  pdfOutputPath: string;
}) => {
  await mockCreateNewFile({ electronApp, filePath: pdfOutputPath });

  await openCommandPalette({ window });

  const exportPdfOption = window.getByText('Export to PDF');
  await exportPdfOption.waitFor({ state: 'visible', timeout: 2_000 });
  await exportPdfOption.click();

  // Wait for PDF file to be written to disk
  const deadline = Date.now() + 15_000;
  while (!fs.existsSync(pdfOutputPath) && Date.now() < deadline) {
    await window.waitForTimeout(500);
  }
};

test('export to PDF produces a valid PDF file', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  const pdfOutputPath = path.join(os.tmpdir(), `v2-e2e-pdf-${Date.now()}.pdf`);
  await exportToPdf({ electronApp, window, pdfOutputPath });

  expect(fs.existsSync(pdfOutputPath)).toBe(true);
  const pdfSize = fs.statSync(pdfOutputPath).size;
  expect(pdfSize).toBeGreaterThan(1000);

  // Every valid PDF starts with the magic bytes "%PDF-" (e.g. "%PDF-1.4").
  // This ensures we got an actual PDF, not an empty file or error page.
  const header = fs.readFileSync(pdfOutputPath).subarray(0, 5);
  expect(header.toString('ascii')).toBe('%PDF-');

  try {
    fs.unlinkSync(pdfOutputPath);
  } catch {}
});
