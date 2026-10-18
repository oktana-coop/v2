import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  richTextRepresentations,
} from './models';

export const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

type ParagraphPMJSON = {
  type: 'doc';
  content: [{ type: 'paragraph'; content: [{ type: 'text'; text: string }] }];
};

export const proseMirrorDocument = (text: string): RichTextDocument => {
  const json: ParagraphPMJSON = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    representation: richTextRepresentations.PROSEMIRROR,
    content: JSON.stringify(json),
  };
};

export const transformParagraphToText = async ({ input }: { input: string }) =>
  (JSON.parse(input) as ParagraphPMJSON).content[0].content[0].text;
