import { yamlLanguage } from '@codemirror/lang-yaml';
import { indentUnit, LanguageSupport } from '@codemirror/language';
import { type Extension } from '@codemirror/state';
import { styleTags, tags } from '@lezer/highlight';

// The grammar tags unquoted and multi-line values as content, which themes
// don't colour; tag them as strings, as quoted ones are. Keys keep their own
// tag, which applies to them more specifically.
const yamlWithStringScalars = yamlLanguage.configure({
  props: [
    styleTags({
      Literal: tags.string,
      BlockLiteralContent: tags.string,
    }),
  ],
});

// Tabs are not valid YAML indentation.
const twoSpaceIndentation = indentUnit.of('  ');

export const yamlSupport: Extension = [
  new LanguageSupport(yamlWithStringScalars),
  twoSpaceIndentation,
];
