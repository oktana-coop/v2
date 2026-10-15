import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { describe, expect, it } from 'vitest';

import { diagnosticSeverities, parsePlainText } from '../../models';
import { createAdapter } from './index';

const linter = createAdapter();

const lint = (text: string) =>
  Effect.runPromise(pipe(parsePlainText(text), Effect.flatMap(linter.lint)));

describe('JSON linter', () => {
  it('reports nothing for valid JSON', async () => {
    const diagnostics = await lint('{\n  "name": "v2",\n  "tags": [1, 2]\n}\n');

    expect(diagnostics).toEqual([]);
  });

  it('reports a missing value as an error where the value should be', async () => {
    const text = '{\n  "name": "v2",\n  "version": }\n';

    const diagnostics = await lint(text);

    expect(diagnostics).toEqual([
      {
        from: 31,
        to: 32,
        severity: diagnosticSeverities.ERROR,
        message: 'Expected a value',
        code: 'ValueExpected',
      },
    ]);
    expect(text.slice(diagnostics[0].from)).toBe('}\n');
  });

  it('reports a trailing comma in an array where the value should be', async () => {
    const text = '[1, 2,]';

    const diagnostics = await lint(text);

    expect(diagnostics).toEqual([
      expect.objectContaining({ from: 6, message: 'Expected a value' }),
    ]);
  });

  it('reports only the first of the errors at one position', async () => {
    const diagnostics = await lint('{"name": "v2",}');

    expect(diagnostics).toEqual([
      expect.objectContaining({
        from: 14,
        message: 'Expected a property name in double quotes',
      }),
    ]);
  });

  it('reports every error in the file', async () => {
    const diagnostics = await lint('{"a" 1, "b": }');

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'ColonExpected',
      'ValueExpected',
    ]);
  });

  it('reports comments, which JSON does not allow', async () => {
    const diagnostics = await lint('// settings\n{}');

    expect(diagnostics).toEqual([
      expect.objectContaining({
        from: 0,
        to: 11,
        message: 'Comments are not allowed in JSON',
      }),
    ]);
  });

  it('reports an empty file as missing its value', async () => {
    const diagnostics = await lint('');

    expect(diagnostics).toEqual([
      expect.objectContaining({ from: 0, to: 0, message: 'Expected a value' }),
    ]);
  });
});
