import * as Effect from 'effect/Effect';
import { parse, type ParseError, printParseErrorCode } from 'jsonc-parser';

import { type Diagnostic, diagnosticSeverities } from '../../models';
import { type Linter } from '../../ports';

type ErrorName = ReturnType<typeof printParseErrorCode>;

const messages: Record<ErrorName, string> = {
  InvalidSymbol: 'Unexpected text',
  InvalidNumberFormat: 'Invalid number',
  PropertyNameExpected: 'Expected a property name in double quotes',
  ValueExpected: 'Expected a value',
  ColonExpected: "Expected ':' after the property name",
  CommaExpected: "Expected ','",
  CloseBraceExpected: "Expected '}'",
  CloseBracketExpected: "Expected ']'",
  EndOfFileExpected: 'Expected nothing after the value',
  InvalidCommentToken: 'Comments are not allowed in JSON',
  UnexpectedEndOfComment: 'Unterminated comment',
  UnexpectedEndOfString: 'Unterminated string',
  UnexpectedEndOfNumber: 'Incomplete number',
  InvalidUnicode: 'Invalid Unicode escape',
  InvalidEscapeCharacter: 'Invalid escape character',
  InvalidCharacter: 'Invalid character in a string',
  '<unknown ParseErrorCode>': 'Invalid JSON',
};

const toDiagnostic = (error: ParseError): Diagnostic => {
  const name = printParseErrorCode(error.error);

  return {
    from: error.offset,
    to: error.offset + error.length,
    severity: diagnosticSeverities.ERROR,
    message: messages[name],
    code: name,
  };
};

// Errors that follow from another at the same position say nothing new.
const isFirstAtItsOffset = (
  error: ParseError,
  index: number,
  errors: ParseError[]
) => errors.findIndex(({ offset }) => offset === error.offset) === index;

export const createAdapter = (): Linter => ({
  lint: (text) =>
    Effect.sync(() => {
      const errors: ParseError[] = [];
      parse(text, errors, {
        disallowComments: true,
        allowTrailingComma: false,
        allowEmptyContent: false,
      });

      return errors.filter(isFirstAtItsOffset).map(toDiagnostic);
    }),
});
