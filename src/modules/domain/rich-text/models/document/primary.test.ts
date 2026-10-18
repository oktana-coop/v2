import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { VersionedDocumentValidationErrorTag } from '../../errors';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentations,
} from '../representation';
import {
  parsePrimaryRichTextDocument,
  primaryRichTextDocument,
} from './primary';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('primaryRichTextDocument', () => {
  it('labels content as being in the primary representation', () => {
    expect(primaryRichTextDocument('# Notes')).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
      content: '# Notes',
    });
  });
});

describe('parsePrimaryRichTextDocument', () => {
  it('accepts a document in the primary representation', async () => {
    const document = await Effect.runPromise(
      parsePrimaryRichTextDocument({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content: '# Notes',
      })
    );

    expect(document.content).toBe('# Notes');
  });

  it('refuses a document in another representation', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        parsePrimaryRichTextDocument({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          representation: richTextRepresentations.PROSEMIRROR,
          content: '{"type":"doc"}',
        })
      )
    );

    expect(failure._tag).toBe(VersionedDocumentValidationErrorTag);
  });
});
