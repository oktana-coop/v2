import * as Effect from 'effect/Effect';
import { parseAllDocuments, type YAMLError } from 'yaml';

import {
  type Diagnostic,
  diagnosticSeverities,
  type DiagnosticSeverity,
} from '../../models';
import { type Linter } from '../../ports';

const toPositionInText = ({
  position,
  text,
}: {
  position: number;
  text: string;
}): number => Math.min(Math.max(position, 0), text.length);

const toDiagnostic =
  ({ text, severity }: { text: string; severity: DiagnosticSeverity }) =>
  (issue: YAMLError): Diagnostic => ({
    from: toPositionInText({ position: issue.pos[0], text }),
    to: toPositionInText({ position: issue.pos[1], text }),
    severity,
    message: issue.message,
    code: issue.code,
  });

export const createAdapter = (): Linter => ({
  lint: (text) =>
    Effect.sync(() => {
      const documents = parseAllDocuments(text, { prettyErrors: false });
      // A stream without documents carries its own errors and warnings.
      const sources = 'empty' in documents ? [documents] : documents;

      return sources.flatMap((source) => [
        ...source.errors.map(
          toDiagnostic({ text, severity: diagnosticSeverities.ERROR })
        ),
        ...source.warnings.map(
          toDiagnostic({ text, severity: diagnosticSeverities.WARNING })
        ),
      ]);
    }),
});
