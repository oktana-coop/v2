import { render, waitFor } from '@testing-library/react';
import { type Node as PMNode } from 'prosemirror-model';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  prosemirror,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import {
  ProseMirrorContext,
  type ProseMirrorContextType,
} from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { RichTextEditor } from './RichTextEditor';

const { schema } = prosemirror;

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

const paragraph = (text: string): PMNode =>
  schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ]);

describe('RichTextEditor', () => {
  // A document swapped in while its predecessor is still converting must win,
  // even if the predecessor's conversion resolves first.
  it('builds from the latest document, not a superseded one', async () => {
    // Both conversions settle in call order, the superseded one first.
    const convertToProseMirror = vi
      .fn()
      .mockResolvedValueOnce(paragraph('from superseded'))
      .mockResolvedValueOnce(paragraph('from latest'));

    // Only the conversion is exercised on this path; the rest goes unused.
    const context = {
      setView: () => {},
      convertToProseMirror,
      parseMarkdown: vi.fn(),
    } as unknown as ProseMirrorContextType;

    const editor = (doc: RichTextDocument) => (
      <ProseMirrorContext.Provider value={context}>
        <RichTextEditor
          doc={doc}
          isEditable={false}
          pickAsset={async () => null}
          resolveAssetSrc={(src) => src}
        />
      </ProseMirrorContext.Provider>
    );

    const { container, rerender } = render(
      editor(markdownDocument('superseded'))
    );
    rerender(editor(markdownDocument('latest')));

    await waitFor(() => expect(container.textContent).toContain('from latest'));
    expect(container.textContent).not.toContain('from superseded');
  });
});
