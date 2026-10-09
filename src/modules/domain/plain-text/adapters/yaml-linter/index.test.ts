import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { describe, expect, it } from 'vitest';

import { diagnosticSeverities, parseNormalizedText } from '../../models';
import { createAdapter } from './index';

const linter = createAdapter();

const lint = (text: string) =>
  Effect.runPromise(
    pipe(parseNormalizedText(text), Effect.flatMap(linter.lint))
  );

describe('YAML linter', () => {
  it('reports nothing for valid YAML', async () => {
    const diagnostics = await lint('name: v2\ntags: [editor, git]\n');

    expect(diagnostics).toEqual([]);
  });

  it('reports nothing for an empty or comment-only file', async () => {
    const empty = await lint('');
    const commentOnly = await lint('# nothing here yet\n');

    expect(empty).toEqual([]);
    expect(commentOnly).toEqual([]);
  });

  it('reports a duplicate key as an error where the repeated key starts', async () => {
    const text = 'name: v2\nname: v3\n';

    const diagnostics = await lint(text);

    expect(diagnostics).toEqual([
      {
        from: 9,
        to: 10,
        severity: diagnosticSeverities.ERROR,
        message: 'Map keys must be unique',
        code: 'DUPLICATE_KEY',
      },
    ]);
    expect(text.slice(diagnostics[0].from)).toBe('name: v3\n');
  });

  it('reports a tab used as indentation as an error', async () => {
    const diagnostics = await lint('editor:\n\tname: v2\n');

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: diagnosticSeverities.ERROR,
        code: 'TAB_AS_INDENT',
      }),
    ]);
  });

  it('reports an unresolved tag as a warning', async () => {
    const diagnostics = await lint('name: !custom v2\n');

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: diagnosticSeverities.WARNING,
        code: 'TAG_RESOLVE_FAILED',
      }),
    ]);
  });

  it('reports problems in a file without documents', async () => {
    const diagnostics = await lint('%FOO bar\n');

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: diagnosticSeverities.WARNING,
        code: 'BAD_DIRECTIVE',
      }),
    ]);
  });

  it('reports problems in every document of a file', async () => {
    const diagnostics = await lint('a: 1\na: 2\n---\nb: 1\nb: 2\n');

    expect(diagnostics.map(({ from }) => from)).toEqual([5, 19]);
  });

  it('keeps positions within the text', async () => {
    const text = 'tags: [editor, git\n';

    const diagnostics = await lint(text);

    expect(diagnostics.length).toBeGreaterThan(0);
    diagnostics.forEach(({ from, to }) => {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(text.length);
    });
  });
});
