import { inputRules } from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';

import {
  blockquoteRule,
  bulletListRule,
  codeBlockRule,
  headingRule,
  orderedListRule,
} from './blocks';

export const buildInputRules = (schema: Schema) => {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 4),
      codeBlockRule(schema.nodes.code_block),
      blockquoteRule(schema.nodes.blockquote),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),
    ],
  });
};
