export const isMarkdown = (text: string): boolean => {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Strong indicators that are unambiguous
  const strongPatterns = [
    /^#{1,6}\s/m, // Headers: # Header
    /```/, // Code blocks
    /\[.+?\]\(.+?\)/, // Links: [text](url)
    /^[-*+]\s/m, // List items at start of line
    /^\d+\.\s/m, // Numbered lists
    /^>\s/m, // Blockquotes
  ];

  // Check if any strong pattern matches
  for (const pattern of strongPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Weak indicators - need multiple to confirm
  const weakMatches = [
    /\*\*.+?\*\*/.test(text), // Bold
    /__.+?__/.test(text), // Bold alt
    /\*.+?\*/.test(text), // Italic
    /_.+?_/.test(text), // Italic alt
    /~~.+?~~/.test(text), // Strikethrough
    /`[^`]+`/.test(text), // Inline code
  ].filter(Boolean).length;

  // If we have 2+ weak indicators, consider it Markdown
  return weakMatches >= 2;
};
