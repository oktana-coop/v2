import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type RichTextDocument } from '../../../../modules/domain/rich-text';
import {
  doc,
  para,
} from '../../../../modules/domain/rich-text/prosemirror/test-utils';
import {
  ProseMirrorContext,
  type ProseMirrorContextType,
} from '../../../../modules/domain/rich-text/react/prosemirror-context';
import { markdownDocument } from '../../../../modules/domain/rich-text/test-utils';
import { SnapshotRichTextDocumentEditor } from './SnapshotRichTextDocumentEditor';

describe('SnapshotRichTextDocumentEditor', () => {
  // A document swapped in while its predecessor is still converting must win,
  // even if the predecessor's conversion resolves first.
  it('builds from the latest document, not a superseded one', async () => {
    // Both conversions settle in call order, the superseded one first.
    const convertToProseMirror = vi
      .fn()
      .mockResolvedValueOnce(doc([para('from superseded')]))
      .mockResolvedValueOnce(doc([para('from latest')]));

    // Only the conversion is exercised on this path; the rest goes unused.
    const context = {
      setView: () => {},
      clearViewIfCurrent: () => {},
      subscribeToViewState: () => () => {},
      getViewState: () => null,
      onViewStateChange: () => {},
      convertToProseMirror,
      parseMarkdown: vi.fn(),
    } as unknown as ProseMirrorContextType;

    const editor = (richText: RichTextDocument) => (
      <ProseMirrorContext.Provider value={context}>
        <SnapshotRichTextDocumentEditor
          doc={richText}
          onDocChange={async () => {}}
          assetResolution={{
            pickAsset: async () => null,
            resolveAssetSrc: (src) => src,
          }}
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

  // A document replaced after the view exists swaps state in place; the view
  // survives the switch.
  it('swaps in a document that arrives after the view was created', async () => {
    // Deterministic on input (like the real converter), since conversion may
    // legitimately run more than once per document.
    const convertToProseMirror = vi.fn(
      async ({ document }: { document: RichTextDocument }) =>
        doc([para(`from ${document.content}`)])
    );

    const context = {
      setView: () => {},
      clearViewIfCurrent: () => {},
      subscribeToViewState: () => () => {},
      getViewState: () => null,
      onViewStateChange: () => {},
      convertToProseMirror,
      parseMarkdown: vi.fn(),
    } as unknown as ProseMirrorContextType;

    const editor = (richText: RichTextDocument) => (
      <ProseMirrorContext.Provider value={context}>
        <SnapshotRichTextDocumentEditor
          doc={richText}
          onDocChange={async () => {}}
          assetResolution={{
            pickAsset: async () => null,
            resolveAssetSrc: (src) => src,
          }}
        />
      </ProseMirrorContext.Provider>
    );

    const { container, rerender } = render(editor(markdownDocument('first')));
    await waitFor(() => expect(container.textContent).toContain('from first'));

    rerender(editor(markdownDocument('second')));
    await waitFor(() => expect(container.textContent).toContain('from second'));
    expect(container.textContent).not.toContain('from first');
  });
});
