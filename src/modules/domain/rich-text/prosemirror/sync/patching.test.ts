import * as Either from 'effect/Either';
import { Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import {
  AddMarkStep,
  AttrStep,
  RemoveMarkStep,
  ReplaceStep,
} from 'prosemirror-transform';
import { describe, expect, it } from 'vitest';

import { schema } from '../schema';
import {
  doc,
  editorState,
  heading,
  hr,
  para,
  sliceOf,
  textSlice,
} from '../test-utils';
import { coarseDiffReplace, patch } from './patching';

const strong = schema.marks.strong.create();

const helloBigWorld = schema.node('paragraph', null, [
  schema.text('Hello '),
  schema.text('big', [strong]),
  schema.text(' world'),
]);

const errorMessageOf = (result: Either.Either<unknown, Error>) =>
  Either.match(result, {
    onLeft: (error) => error.message,
    onRight: () => null,
  });

describe('patch', () => {
  it.each([
    {
      kind: 'replace (insert)',
      before: [para('Hello world')],
      steps: [new ReplaceStep(7, 7, textSlice('big '))],
      after: [para('Hello big world')],
    },
    {
      kind: 'replace (delete)',
      before: [para('Hello big world')],
      steps: [new ReplaceStep(7, 11, Slice.empty)],
      after: [para('Hello world')],
    },
    {
      kind: 'addMark',
      before: [para('Hello big world')],
      steps: [new AddMarkStep(7, 10, strong)],
      after: [helloBigWorld],
    },
    {
      kind: 'removeMark',
      before: [helloBigWorld],
      steps: [new RemoveMarkStep(7, 10, strong)],
      after: [para('Hello big world')],
    },
    {
      kind: 'attr',
      before: [heading({ text: 'Title', level: 1 })],
      steps: [new AttrStep(0, 'level', 2)],
      after: [heading({ text: 'Title', level: 2 })],
    },
  ])('applies a $kind step', ({ before, steps, after }) => {
    const result = patch({
      state: editorState(before),
      steps,
      target: doc(after),
    });

    expect(Either.isRight(result)).toBe(true);
  });

  it('applies two regions as one transaction and maps a caret between them', () => {
    const state = editorState([para('Hello world')]);
    const withCaret = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 6))
    );

    const result = patch({
      state: withCaret,
      steps: [
        new ReplaceStep(1, 1, textSlice('X')),
        new ReplaceStep(13, 13, textSlice('Y')),
      ],
      target: doc([para('XHello worldY')]),
    });

    const tr = Either.getOrThrow(result);
    expect(tr.steps).toHaveLength(2);
    expect(tr.selection.head).toBe(7);
  });

  it('reports the index of a step that fails to apply', () => {
    const result = patch({
      state: editorState([para('Hello')]),
      steps: [
        new ReplaceStep(6, 6, textSlice('!')),
        // Text straight under the doc node is invalid content.
        new ReplaceStep(0, 0, textSlice('x')),
      ],
      target: doc([para('Hello!')]),
    });

    expect(errorMessageOf(result)).toContain('(step 1)');
  });

  it('reports a step outside the document', () => {
    const result = patch({
      state: editorState([para('Hello')]),
      steps: [new ReplaceStep(40, 41, Slice.empty)],
      target: doc([para('Hello')]),
    });

    expect(errorMessageOf(result)).toContain('(step 0)');
  });

  it('reports a final document that differs from the target', () => {
    const result = patch({
      state: editorState([para('Hello')]),
      steps: [new ReplaceStep(6, 6, textSlice('!'))],
      target: doc([para('Hello?')]),
    });

    expect(errorMessageOf(result)).toBe(
      'The applied steps do not produce the incoming document'
    );
  });

  it('adds the trailing paragraph the target ends with', () => {
    const result = patch({
      state: editorState([para('a')]),
      steps: [new ReplaceStep(3, 3, sliceOf(hr()))],
      target: doc([para('a'), hr(), para()]),
    });

    expect(Either.isRight(result)).toBe(true);
  });

  it('removes the trailing paragraph a remote append made stale', () => {
    // The editor holds the trailing paragraph; the steps were computed
    // against the doc without it, so the append lands before it.
    const result = patch({
      state: editorState([para('a'), hr(), para()]),
      steps: [new ReplaceStep(4, 4, sliceOf(para('b')))],
      target: doc([para('a'), hr(), para('b')]),
    });

    expect(Either.isRight(result)).toBe(true);
  });
});

describe('coarseDiffReplace', () => {
  const state = editorState([para('Hello world')]);
  const target = doc([para('Hello big world')]);

  it('replaces only the region that differs', () => {
    const tr = coarseDiffReplace({ state, target });

    expect(tr.doc.eq(target)).toBe(true);
    expect(tr.mapping.map(1)).toBe(1);
  });

  it('replaces the whole document when nothing is shared', () => {
    const tr = coarseDiffReplace({
      state: EditorState.create({ doc: doc([para()]) }),
      target,
    });

    expect(tr.doc.eq(target)).toBe(true);
  });
});
