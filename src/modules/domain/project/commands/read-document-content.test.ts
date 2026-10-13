import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { artifactKinds, type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { readDocumentContent } from './read-document-content';
import { markdownDocument } from './test-utils';

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/notes.md' as ArtifactId;

const setUp = () => {
  const findRichTextDocumentById = vi.fn<
    ProjectStore['findRichTextDocumentById']
  >(() =>
    Effect.succeed({ id: documentId, artifact: markdownDocument('# Notes') })
  );
  const findPlainTextDocumentById = vi.fn<
    ProjectStore['findPlainTextDocumentById']
  >(() => Effect.succeed({ content: 'a: 1\n' }));

  return {
    read: readDocumentContent({
      findRichTextDocumentById,
      findPlainTextDocumentById,
    }),
    findRichTextDocumentById,
    findPlainTextDocumentById,
  };
};

describe('readDocumentContent', () => {
  it('reads a rich-text document as rich text', async () => {
    const { read, findPlainTextDocumentById } = setUp();

    const content = await Effect.runPromise(
      read(artifactKinds.RICH_TEXT_DOCUMENT)({ projectId, documentId })
    );

    expect(content).toBe('# Notes');
    expect(findPlainTextDocumentById).not.toHaveBeenCalled();
  });

  it('reads a plain-text document as plain text', async () => {
    const { read, findRichTextDocumentById } = setUp();

    const content = await Effect.runPromise(
      read(artifactKinds.PLAIN_TEXT_DOCUMENT)({ projectId, documentId })
    );

    expect(content).toBe('a: 1\n');
    expect(findRichTextDocumentById).not.toHaveBeenCalled();
  });
});
