import * as Effect from 'effect/Effect';

import { type Diagnostic, type PlainText } from '../models';

export type Linter = {
  lint: (text: PlainText) => Effect.Effect<Diagnostic[]>;
};
