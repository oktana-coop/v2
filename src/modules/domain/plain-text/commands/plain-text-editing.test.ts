import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { promiseWithResolvers } from '../../../../utils/test-utils';
import { plainTextDocument } from '../models';
import { type PlainTextConvergentDocument } from '../ports';
import { plainTextEditing } from './plain-text-editing';

const startEditing = async ({
  change = vi.fn<PlainTextConvergentDocument['change']>(() =>
    Effect.succeed('v1')
  ),
}: {
  change?: PlainTextConvergentDocument['change'];
} = {}) => {
  const contributor = await Effect.runPromise(plainTextEditing({ change }));

  return { contributor, change };
};

describe('plainTextEditing', () => {
  it('contributes an edit right away, resolving with its version', async () => {
    const { contributor, change } = await startEditing();
    const doc = plainTextDocument('a: 1\n');

    const version = await Effect.runPromise(
      contributor.edit(doc, { base: 'v0' })
    );

    expect(version).toBe('v1');
    expect(change).toHaveBeenCalledExactlyOnceWith(doc, { base: 'v0' });
  });

  it('has no pending edits to apply or drop', async () => {
    const { contributor, change } = await startEditing();

    await Effect.runPromise(contributor.applyPendingLocalEdits);
    await Effect.runPromise(contributor.dropPendingLocalEdits);

    expect(change).not.toHaveBeenCalled();
  });

  it('closes the document once the edit in flight is contributed', async () => {
    const contribution = promiseWithResolvers<string>();
    const { contributor } = await startEditing({
      change: () => Effect.promise(() => contribution.promise),
    });
    const closeDocument = vi.fn();

    const editing = Effect.runPromise(
      contributor.edit(plainTextDocument('a: 1\n'))
    );
    const closing = Effect.runPromise(
      contributor.close(Effect.sync(closeDocument))
    );
    await Promise.resolve();

    expect(closeDocument).not.toHaveBeenCalled();

    contribution.resolve('v1');
    await editing;
    await closing;

    expect(closeDocument).toHaveBeenCalledOnce();
  });
});
