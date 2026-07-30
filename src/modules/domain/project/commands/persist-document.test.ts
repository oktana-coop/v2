import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RichTextDocument,
  richTextRepresentations,
  VersionedDocumentRepresentationTransformErrorTag,
} from '../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { RepositoryError, VersionedProjectRepositoryErrorTag } from '../errors';
import { parseProjectId } from '../models';
import { persistDocument, type PersistDocumentDeps } from './persist-document';

const projectId = parseProjectId('/tmp/v2-persist-document-test');
// The store functions are mocked, so the id's actual value is irrelevant.
const documentId = 'note.md' as unknown as ArtifactId;

const primaryDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

const editorDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content,
});

const transformed = (content: string) => `md:${content}`;

const buildDeps = (
  overrides: Partial<PersistDocumentDeps> = {}
): PersistDocumentDeps => ({
  transformToText: vi.fn(async ({ input }: { input: string }) =>
    transformed(input)
  ),
  updateRichTextDocumentContent: vi.fn(() => Effect.void),
  ...overrides,
});

describe('persistDocument', () => {
  it('transforms to the primary representation and writes the result', async () => {
    const deps = buildDeps();

    const written = await Effect.runPromise(
      persistDocument(deps)({
        projectId,
        documentId,
        document: editorDocument('typed'),
      })
    );

    expect(written).toBe(transformed('typed'));
    expect(deps.transformToText).toHaveBeenCalledWith({
      from: richTextRepresentations.PROSEMIRROR,
      to: PRIMARY_RICH_TEXT_REPRESENTATION,
      input: 'typed',
    });
    expect(deps.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
    expect(deps.updateRichTextDocumentContent).toHaveBeenCalledWith({
      projectId,
      documentId,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: transformed('typed'),
    });
  });

  it('writes an already-primary document verbatim, without transforming', async () => {
    const deps = buildDeps();

    const written = await Effect.runPromise(
      persistDocument(deps)({
        projectId,
        documentId,
        document: primaryDocument('already primary'),
      })
    );

    expect(written).toBe('already primary');
    expect(deps.transformToText).not.toHaveBeenCalled();
    expect(deps.updateRichTextDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'already primary' })
    );
  });

  it('skips the write when the content equals skipIfContentEquals', async () => {
    const deps = buildDeps();

    const written = await Effect.runPromise(
      persistDocument(deps)({
        projectId,
        documentId,
        document: editorDocument('typed'),
        skipIfContentEquals: transformed('typed'),
      })
    );

    expect(written).toBe(transformed('typed'));
    expect(deps.updateRichTextDocumentContent).not.toHaveBeenCalled();
  });

  it('compares skipIfContentEquals against the transformed content, not the input', async () => {
    const deps = buildDeps();

    await Effect.runPromise(
      persistDocument(deps)({
        projectId,
        documentId,
        document: editorDocument('typed'),
        skipIfContentEquals: 'typed',
      })
    );

    expect(deps.updateRichTextDocumentContent).toHaveBeenCalledTimes(1);
  });

  it('fails with RepresentationTransformError and does not write when the transform fails', async () => {
    const deps = buildDeps({
      transformToText: vi.fn(async () => {
        throw new Error('conversion failed');
      }),
    });

    const error = await Effect.runPromise(
      Effect.flip(
        persistDocument(deps)({
          projectId,
          documentId,
          document: editorDocument('typed'),
        })
      )
    );

    expect(error._tag).toBe(VersionedDocumentRepresentationTransformErrorTag);
    expect(deps.updateRichTextDocumentContent).not.toHaveBeenCalled();
  });

  it('propagates a failing write', async () => {
    const deps = buildDeps({
      updateRichTextDocumentContent: vi.fn(() =>
        Effect.fail(new RepositoryError('write failed'))
      ),
    });

    const error = await Effect.runPromise(
      Effect.flip(
        persistDocument(deps)({
          projectId,
          documentId,
          document: editorDocument('typed'),
        })
      )
    );

    expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
  });
});
