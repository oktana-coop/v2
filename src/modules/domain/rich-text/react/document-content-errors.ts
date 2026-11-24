import {
  InvalidMetadataError,
  type UnrepresentableContent,
  UnrepresentableContentError,
} from '../errors';

const unrepresentableContentNames: Record<UnrepresentableContent, string> = {
  tables: 'tables',
  definitionLists: 'definition lists',
  lineBlocks: 'line blocks',
  rawBlocks: 'embedded HTML or LaTeX',
  strikeout: 'strikethrough',
  underline: 'underlined text',
  smallCaps: 'small caps',
  superscript: 'superscript',
  subscript: 'subscript',
  spans: 'text with custom attributes',
  math: 'math',
  citations: 'citations',
  rawInlines: 'embedded HTML or LaTeX',
  metadataNotes: 'footnotes in the document metadata',
};

export const getDocumentContentErrorMessage = (
  error: unknown
): string | undefined => {
  if (error instanceof InvalidMetadataError) {
    return "The document metadata isn't valid.";
  }

  if (error instanceof UnrepresentableContentError) {
    const names = [
      ...new Set(
        error.data.content.map(
          (content) => unrepresentableContentNames[content]
        )
      ),
    ];

    return `The editor can't show ${new Intl.ListFormat('en', { type: 'conjunction' }).format(names)} yet.`;
  }

  return undefined;
};
