import { inputRules } from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';

import {
  bulletListRule,
  codeBlockRule,
  headingRule,
  orderedListRule,
} from './blocks';
import {
  emAsteriskMarkRule,
  emUnderscorekMarkRule,
  strongAsteriskMarkRule,
  strongUnderscoreMarkRule,
} from './marks';

export const buildInputRules = (schema: Schema) => {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 4),
      codeBlockRule(schema.nodes.code_block),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),
      strongAsteriskMarkRule(schema),
      strongUnderscoreMarkRule(schema),
      emAsteriskMarkRule(schema),
      emUnderscorekMarkRule(schema),
    ],
  });
};
