import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { DocumentAnalysisErrorTag, RichTextLibErrorTag } from '../../errors';
import { richTextRepresentations } from '../../models';
import { createAdapter } from './index';

const mockContent = 'some doc';

const extract = ({
  mockedCliRun,
  content = mockContent,
}: {
  mockedCliRun: Wasm['runWasiCLIOutputingText'];
  content?: string;
}) =>
  createAdapter({
    runWasiCLIOutputingText: mockedCliRun,
  }).extractLocalAssetReferences({
    representation: richTextRepresentations.MARKDOWN,
    content,
  });

describe('pandoc-document-analyzer', () => {
  it('keeps local references and drops external ones', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        data: [
          'assets/x.png',
          'https://example.com/y.png',
          'data:image/png;base64,xyz',
          '//cdn.example.com/z.png',
          'images/w.png',
        ],
      })
    );

    const refs = await Effect.runPromise(extract({ mockedCliRun }));

    expect(refs).toEqual(['assets/x.png', 'images/w.png']);
  });

  it('drops degenerate empty srcs (e.g. `![]()`) without failing', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ data: ['', 'assets/x.png'] }));

    const refs = await Effect.runPromise(extract({ mockedCliRun }));

    expect(refs).toEqual(['assets/x.png']);
  });

  it('does not normalize paths (leaves `./`, `../` and resolution to the caller)', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ data: ['./assets/x.png', '../../shared/y.png'] })
      );

    const refs = await Effect.runPromise(extract({ mockedCliRun }));

    expect(refs).toEqual(['./assets/x.png', '../../shared/y.png']);
  });

  it('POSIX-normalizes backslash separators', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ data: ['assets\\sub\\x.png'] }));

    const refs = await Effect.runPromise(extract({ mockedCliRun }));

    expect(refs).toEqual(['assets/sub/x.png']);
  });

  it('short-circuits empty content without invoking the CLI', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue('{"data":["assets/x.png"]}');

    const refs = await Effect.runPromise(
      extract({ mockedCliRun, content: '' })
    );

    expect(refs).toEqual([]);
    expect(mockedCliRun).not.toHaveBeenCalled();
  });

  it('invokes the CLI with the extractAssetUrls command and format', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue('{"data":[]}');

    await Effect.runPromise(extract({ mockedCliRun, content: mockContent }));

    expect(mockedCliRun).toHaveBeenCalledWith({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'extractAssetUrls',
        '--format',
        'markdown',
        '--',
        mockContent,
      ],
    });
  });

  it('fails with DocumentAnalysisError when the CLI returns errors', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ errors: [{ message: 'boom' }] }));

    const error = await Effect.runPromise(
      extract({ mockedCliRun }).pipe(Effect.flip)
    );

    expect(error._tag).toBe(DocumentAnalysisErrorTag);
    expect(error.message).toContain('boom');
  });

  it('fails with RichTextLibError on invalid JSON output', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue('not json');

    const error = await Effect.runPromise(
      extract({ mockedCliRun }).pipe(Effect.flip)
    );

    expect(error._tag).toBe(RichTextLibErrorTag);
  });

  it('fails with RichTextLibError when the CLI call rejects', async () => {
    const mockedCliRun = vi.fn().mockRejectedValue(new Error('wasm exploded'));

    const error = await Effect.runPromise(
      extract({ mockedCliRun }).pipe(Effect.flip)
    );

    expect(error._tag).toBe(RichTextLibErrorTag);
  });
});
