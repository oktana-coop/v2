import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { type Wasm } from '../../../../../modules/infrastructure/wasm';
import {
  InvalidMetadataErrorTag,
  UnrepresentableContentErrorTag,
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
              'The figure content must contain at most one image (no other inline content)',
          },
        ],
      })
    );

    await expect(toProseMirror({ mockedCliRun })).rejects.toMatchObject({
      _tag: VersionedDocumentRepresentationTransformErrorTag,
      message:
        'Conversion failed: The figure content must contain at most one image (no other inline content)',
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

  it('fails with UnrepresentableContentError for content the editor cannot show', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [
          {
            type: 'unrepresentableContentError',
            message:
              "The document has content ProseMirror can't represent: tables, lineBlocks",
            content: ['tables', 'lineBlocks'],
          },
        ],
      })
    );

    await expect(toProseMirror({ mockedCliRun })).rejects.toMatchObject({
      _tag: UnrepresentableContentErrorTag,
      data: { content: ['tables', 'lineBlocks'] },
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

describe('pandoc-representation-transform normalizeFrontMatter', () => {
  const normalize = ({
    mockedCliRun,
    frontMatter,
  }: {
    mockedCliRun: Wasm['runWasiCLIOutputingText'];
    frontMatter: string;
  }) =>
    createAdapter({
      runWasiCLIOutputingText: mockedCliRun,
      pdfEngine: {} as PdfEngine,
    }).normalizeFrontMatter(frontMatter);

  it('succeeds with the normalized front matter the CLI returns', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ data: 'draft: false\n' }));

    const normalized = await Effect.runPromise(
      normalize({ mockedCliRun, frontMatter: 'draft: false' })
    );

    expect(normalized).toBe('draft: false\n');
    expect(mockedCliRun).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [
          'v2-hs-lib',
          'normalizeFrontMatterForProseMirror',
          '--',
          'draft: false',
        ],
      })
    );
  });

  it('succeeds with null when the CLI leaves no metadata', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ data: null }));

    const normalized = await Effect.runPromise(
      normalize({ mockedCliRun, frontMatter: 'title: ""' })
    );

    expect(normalized).toBeNull();
  });

  it('fails with InvalidMetadataError, with the CLI message, when the front matter is not valid', async () => {
    const message = 'YAML parse exception at line 1, column 8';
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [{ type: 'invalidMetadataError', message }],
      })
    );

    const error = await Effect.runPromise(
      Effect.flip(normalize({ mockedCliRun, frontMatter: 'title: [unclosed' }))
    );

    expect(error).toMatchObject({ _tag: InvalidMetadataErrorTag, message });
  });

  it('fails with RepresentationTransformError for other errors the CLI reports', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        errors: [{ type: 'writeError', message: 'Something went wrong' }],
      })
    );

    const error = await Effect.runPromise(
      Effect.flip(normalize({ mockedCliRun, frontMatter: 'title: Hello' }))
    );

    expect(error).toMatchObject({
      _tag: VersionedDocumentRepresentationTransformErrorTag,
      message: 'Normalizing the front matter failed: Something went wrong',
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
