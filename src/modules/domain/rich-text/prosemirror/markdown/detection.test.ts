import { isMarkdown } from './detection';

describe('isMarkdown', () => {
  describe('detects Markdown', () => {
    it('detects headers', () => {
      expect(isMarkdown('# Heading 1')).toBe(true);
      expect(isMarkdown('## Heading 2')).toBe(true);
      expect(isMarkdown('### Heading 3')).toBe(true);
    });

    it('detects code blocks', () => {
      expect(isMarkdown('```markdown\nconst x = 1;\n```')).toBe(true);
      expect(isMarkdown('```\ncode here\n```')).toBe(true);
    });

    it('detects links', () => {
      expect(isMarkdown('[Google](https://google.com)')).toBe(true);
      expect(isMarkdown('Check out [this link](https://example.com)')).toBe(
        true
      );
    });

    it('detects unordered lists', () => {
      expect(isMarkdown('- Item 1\n- Item 2')).toBe(true);
      expect(isMarkdown('* Item 1\n* Item 2')).toBe(true);
      expect(isMarkdown('+ Item 1')).toBe(true);
    });

    it('detects ordered lists', () => {
      expect(isMarkdown('1. First item\n2. Second item')).toBe(true);
      expect(isMarkdown('1. Single item')).toBe(true);
    });

    it('detects blockquotes', () => {
      expect(isMarkdown('> This is a quote')).toBe(true);
      expect(isMarkdown('> Line 1\n> Line 2')).toBe(true);
    });

    it('detects multiple formatting marks', () => {
      expect(isMarkdown('This is **bold** and *italic*')).toBe(true);
      expect(isMarkdown('This is **bold** and `code`')).toBe(true);
      expect(isMarkdown('This is __bold__ and ~~strikethrough~~')).toBe(true);
    });

    it('detects complex Markdown documents', () => {
      const markdown = `
# Title

This is a paragraph with **bold** text.

- Item 1
- Item 2

[Link](https://example.com)
      `;
      expect(isMarkdown(markdown)).toBe(true);
    });
  });

  describe('does not falsely detect Markdown', () => {
    it('rejects plain text', () => {
      expect(isMarkdown('This is just plain text')).toBe(false);
      expect(isMarkdown('Hello world')).toBe(false);
    });

    it('rejects empty or whitespace-only text', () => {
      expect(isMarkdown('')).toBe(false);
      expect(isMarkdown('   ')).toBe(false);
      expect(isMarkdown('\n\n')).toBe(false);
    });

    it('rejects hashtags (not headers)', () => {
      expect(isMarkdown('I love #markdown')).toBe(false);
      expect(isMarkdown('#trending #news')).toBe(false);
    });

    it('rejects math expressions with asterisks', () => {
      expect(isMarkdown('2 * 3 * 4')).toBe(false);
      expect(isMarkdown('x * y')).toBe(false);
    });

    it('rejects underscores in variable names', () => {
      expect(isMarkdown('my_variable_name')).toBe(false);
      expect(isMarkdown('user_id')).toBe(false);
    });

    it('rejects single formatting mark', () => {
      expect(isMarkdown('This is **bold')).toBe(false);
      expect(isMarkdown('This is *italic')).toBe(false);
      expect(isMarkdown('This has `code')).toBe(false);
    });

    it('rejects dashes in regular text', () => {
      expect(isMarkdown('well-known fact')).toBe(false);
      expect(isMarkdown('state-of-the-art')).toBe(false);
    });

    it('rejects sentences with periods and numbers', () => {
      expect(isMarkdown('Version 1. Updated yesterday')).toBe(false);
      expect(isMarkdown('Point 1. Make sure to check')).toBe(false);
    });
  });

  describe('handles edge cases in Markdown detection', () => {
    it('handles mixed content appropriately', () => {
      // Has hashtag but also real Markdown
      expect(isMarkdown('# Header\n\nI love #markdown')).toBe(true);

      // Has asterisk in math but also Markdown list
      expect(isMarkdown('- Item 1\n- 2 * 3 = 6')).toBe(true);
    });

    it('handles multiline text without Markdown', () => {
      const text = `
This is a regular paragraph.
It has multiple lines.
But no Markdown formatting.
      `;
      expect(isMarkdown(text)).toBe(false);
    });

    it('detects list-like structures that start mid-line', () => {
      // This should NOT match because the pattern requires start of line
      expect(isMarkdown('Here is a list: - Item 1')).toBe(false);
    });
  });
});
