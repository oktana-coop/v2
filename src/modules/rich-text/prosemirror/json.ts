import { Node, type Schema } from 'prosemirror-model';

export const pmDocFromJSONString = (json: unknown, schema: Schema): Node =>
  Node.fromJSON(schema, json);
