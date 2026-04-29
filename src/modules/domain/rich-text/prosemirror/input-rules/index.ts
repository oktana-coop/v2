import { inputRules } from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';

import {
  blockquoteRule,
  bulletListRule,
  codeBlockRule,
  emDashRule,
  enDashRule,
  headingRule,
  horizontalRuleRule,
  orderedListRule,
} from './blocks';

export const buildInputRules = (schema: Schema) => {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 6),
      codeBlockRule(schema.nodes.code_block),
      blockquoteRule(schema.nodes.blockquote),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),
      horizontalRuleRule(schema.nodes.horizontal_rule),
      emDashRule(),
      enDashRule(),
    ],
  });
};
