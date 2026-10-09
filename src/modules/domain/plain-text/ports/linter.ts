import * as Effect from 'effect/Effect';

import { type Diagnostic, type NormalizedText } from '../models';

export type Linter = {
  lint: (text: NormalizedText) => Effect.Effect<Diagnostic[]>;
};
