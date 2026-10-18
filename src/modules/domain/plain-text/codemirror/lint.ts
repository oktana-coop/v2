import {
  type Diagnostic as EditorDiagnostic,
  linter,
  lintGutter,
} from '@codemirror/lint';
import { type Extension } from '@codemirror/state';
import * as Effect from 'effect/Effect';

import { type Diagnostic, diagnosticSeverities, toPlainText } from '../models';
import { type Linter } from '../ports';

const toEditorDiagnostic = (diagnostic: Diagnostic): EditorDiagnostic => ({
  from: diagnostic.from,
  to: diagnostic.to,
  severity:
    diagnostic.severity === diagnosticSeverities.ERROR ? 'error' : 'warning',
  message: diagnostic.message,
});

export const lint = (textLinter: Linter): Extension => [
  linter(async (view) => {
    const diagnostics = await Effect.runPromise(
      textLinter.lint(toPlainText(view.state.doc.toString()))
    );

    return diagnostics.map(toEditorDiagnostic);
  }),
  lintGutter(),
];
