import type { ValueOf } from 'type-fest';

const ERROR = 'ERROR';
const WARNING = 'WARNING';

export const diagnosticSeverities = {
  ERROR,
  WARNING,
} as const;

export type DiagnosticSeverity = ValueOf<typeof diagnosticSeverities>;

// A problem in a text, between two UTF-16 offsets into it.
export type Diagnostic = {
  from: number;
  to: number;
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
};
