import { describe, expect, it, vi } from 'vitest';

import { type Wasm } from '../../../../../modules/infrastructure/wasm';
import {
  InvalidMetadataErrorTag,
  VersionedDocumentRepresentationTransformErrorTag,
} from '../../errors';
import {
  binaryRichTextRepresentations,
  richTextRepresentations,
} from '../../models';
import { type PdfEngine } from '../../ports/pdf-engine';
import { createAdapter } from './index';

const toProseMirror = ({
  mockedCliRun,
}: {
  mockedCliRun: Wasm['runWasiCLIOutputingText'];
}) =>
  createAdapter({
    runWasiCLIOutputingText: mockedCliRun,
    pdfEngine: {} as PdfEngine,
  }).transformToText({
    from: richTextRepresentations.MARKDOWN,
    to: richTextRepresentations.PROSEMIRROR,
    input: 'Hello',
  });

const toDocx = ({
  mockedCliRun,
}: {
  mockedCliRun: Wasm['runWasiCLIOutputingText'];
}) =>
  createAdapter({
    runWasiCLIOutputingText: mockedCliRun,
    pdfEngine: {} as PdfEngine,
  }).transformToBinary({
    from: richTextRepresentations.MARKDOWN,
    to: binaryRichTextRepresentations.DOCX,
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

  it('fails with InvalidMetadataError, with the CLI message, when the metadata is not valid', async () => {
    const message =
      'Error parsing YAML metadata at (line 1, column 1):\nYAML parse exception at line 2, column 13:\nmapping values are not allowed in this context';
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [{ type: 'invalidMetadataError', message }],
      })
    );

    await expect(toProseMirror({ mockedCliRun })).rejects.toMatchObject({
      _tag: InvalidMetadataErrorTag,
      message,
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

describe('pandoc-representation-transform transformToBinary', () => {
  it('decodes the bytes the CLI sends base64-encoded', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ data: btoa('PK\u0003\u0004') }));

    await expect(toDocx({ mockedCliRun })).resolves.toEqual(
      new Uint8Array([80, 75, 3, 4])
    );
  });

  it('fails with RepresentationTransformError when the CLI reports errors', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [{ type: 'writeError', message: 'Something went wrong' }],
      })
    );

    await expect(toDocx({ mockedCliRun })).rejects.toMatchObject({
      _tag: VersionedDocumentRepresentationTransformErrorTag,
      message: 'Conversion failed: Something went wrong',
    });
  });
});
