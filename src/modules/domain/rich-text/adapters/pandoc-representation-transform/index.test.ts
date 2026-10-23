import { describe, expect, it, vi } from 'vitest';

import { type Wasm } from '../../../../../modules/infrastructure/wasm';
import { VersionedDocumentRepresentationTransformErrorTag } from '../../errors';
import { richTextRepresentations } from '../../models';
import { type PdfEngine } from '../../ports/pdf-engine';
import { createAdapter } from './index';

const toProseMirror = ({
  mockedCliRun,
}: {
  mockedCliRun: Wasm['runWasiCLIOutputingText'];
}) =>
  createAdapter({
    runWasiCLIOutputingText: mockedCliRun,
    runWasiCLIOutputingBinary: vi.fn(),
    pdfEngine: {} as PdfEngine,
  }).transformToText({
    from: richTextRepresentations.MARKDOWN,
    to: richTextRepresentations.PROSEMIRROR,
    input: 'Hello',
  });

describe('pandoc-representation-transform transformToText', () => {
  it('fails with RepresentationTransformError when the CLI reports errors', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [
          {
            type: 'writeError',
            message:
              'Cannot convert input to ProseMirror: it contains content with no ProseMirror representation.',
          },
        ],
      })
    );

    await expect(toProseMirror({ mockedCliRun })).rejects.toMatchObject({
      _tag: VersionedDocumentRepresentationTransformErrorTag,
      message:
        'Conversion failed: Cannot convert input to ProseMirror: it contains content with no ProseMirror representation.',
    });
  });

  it('fails with RepresentationTransformError when the CLI returns no output', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue('');

    await expect(toProseMirror({ mockedCliRun })).rejects.toMatchObject({
      _tag: VersionedDocumentRepresentationTransformErrorTag,
      message: 'Conversion failed: No output returned',
    });
  });
});
