import { textblockTypeInputRule } from 'prosemirror-inputrules';
import { NodeType } from 'prosemirror-model';

// Based on https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/inputrules.ts
export const headingRule = (nodeType: NodeType, maxLevel: number) => {
  return textblockTypeInputRule(
    new RegExp('^(#{1,' + maxLevel + '})\\s$'),
    nodeType,
    (match) => ({ level: match[1].length })
  );
};
