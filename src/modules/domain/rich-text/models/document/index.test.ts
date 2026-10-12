import { describe, expect, it } from 'vitest';

import { richTextRepresentations } from '../representation';
import { richTextDocumentsAreEqual } from '.';
import { CURRENT_SCHEMA_VERSION, type RichTextDocument } from './types';

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

describe('richTextDocumentsAreEqual', () => {
  it('equates documents with the same content in the same representation', () => {
    expect(
      richTextDocumentsAreEqual(
        markdownDocument('# Notes'),
        markdownDocument('# Notes')
      )
    ).toBe(true);
  });

  it('tells apart documents with different content', () => {
    expect(
      richTextDocumentsAreEqual(
        markdownDocument('# Notes'),
        markdownDocument('# Other notes')
      )
    ).toBe(false);
  });

  it('tells apart the same content in different representations', () => {
    expect(
      richTextDocumentsAreEqual(markdownDocument('"notes"'), {
        ...markdownDocument('"notes"'),
        representation: richTextRepresentations.PROSEMIRROR,
      })
    ).toBe(false);
  });

  it('equates documents that differ only in schema version', () => {
    expect(
      richTextDocumentsAreEqual(markdownDocument('# Notes'), {
        ...markdownDocument('# Notes'),
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      })
    ).toBe(true);
  });
});
