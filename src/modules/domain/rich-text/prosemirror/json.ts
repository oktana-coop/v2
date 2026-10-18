import { Node, type Schema } from 'prosemirror-model';
import { Step } from 'prosemirror-transform';

import { type PMStep } from './hs-lib';

export const pmDocFromJSONString = (json: unknown, schema: Schema): Node =>
  Node.fromJSON(schema, json);

export const pmDocToJSONString = (doc: Node) => JSON.stringify(doc.toJSON());

export const pmStepFromJSON = (json: PMStep, schema: Schema): Step =>
  Step.fromJSON(schema, json);
