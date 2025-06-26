import { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

import { markdownMarkPlugin } from './mark-plugin';

// Configuration for different mark types
const MARK_CONFIGS = {
  code: { delimiter: '`' },
  strongAsterisk: { delimiter: '**' },
  strongUnderscore: { delimiter: '__' },
  emAsterisk: {
    delimiter: '*',
    regex: /(?<!\*)\*([^*\n]+)\*(?!\*)/,
  },
  emUnderscore: {
    delimiter: '_',
    regex: /(?<!_)_([^_\n]+)_(?!_)/,
  },
} as const;

export const markdownMarkPlugins = (schema: Schema): Plugin[] => [
  markdownMarkPlugin(schema.marks.code, MARK_CONFIGS.code),
  markdownMarkPlugin(schema.marks.strong, MARK_CONFIGS.strongAsterisk),
  markdownMarkPlugin(schema.marks.strong, MARK_CONFIGS.strongUnderscore),
  markdownMarkPlugin(schema.marks.em, MARK_CONFIGS.emAsterisk),
  markdownMarkPlugin(schema.marks.em, MARK_CONFIGS.emUnderscore),
];
