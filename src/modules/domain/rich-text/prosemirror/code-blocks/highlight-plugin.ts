import { createHighlightPlugin } from 'prosemirror-highlight';
import { createParser, type Parser } from 'prosemirror-highlight/shiki';
import {
  type BuiltinLanguage,
  getSingletonHighlighter,
  type Highlighter,
  isSpecialLang,
} from 'shiki';

let highlighter: Highlighter | undefined;
let parser: Parser | undefined;

/**
 * Lazy load highlighter and highlighter languages.
 *
 * When the highlighter or the required language is not loaded, it returns a
 * promise that resolves when the highlighter or the language is loaded.
 * Otherwise, it returns an array of decorations.
 *
 * The code is based on prosemirror-highlight's lazy loading example:
 * https://github.com/ocavue/prosemirror-highlight
 */
const lazyParser: Parser = (options) => {
  const themes = {
    light: 'catppuccin-macchiato',
    dark: 'slack-dark',
  };

  if (!highlighter) {
    return getSingletonHighlighter({
      themes: Object.values(themes),
      langs: [],
    }).then((h) => {
      highlighter = h;
    });
  }

  // The language constants we defined exactly match the Shiki language names, so we can directly use them.
  // We will need a mapping if this changes.
  const language = options.language as BuiltinLanguage;
  if (
    language &&
    // Resolves an issue with plaintext when lazy loading the Shiki parser.
    // https://github.com/ocavue/prosemirror-highlight/issues/57
    !isSpecialLang(language) &&
    !highlighter.getLoadedLanguages().includes(language)
  ) {
    return highlighter.loadLanguage(language);
  }

  if (!parser) {
    parser = createParser(highlighter, {
      themes,
      defaultColor: false,
    });
  }

  return parser(options);
};

export const codeBlockHighlightPlugin = createHighlightPlugin({
  parser: lazyParser,
});
