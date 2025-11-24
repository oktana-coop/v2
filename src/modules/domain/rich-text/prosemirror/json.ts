import { Node, type Schema } from 'prosemirror-model';

export const pmDocFromJSONString = (json: unknown, schema: Schema): Node =>
  Node.fromJSON(schema, json);

export const pmDocToJSONString = (doc: Node) => JSON.stringify(doc.toJSON());
