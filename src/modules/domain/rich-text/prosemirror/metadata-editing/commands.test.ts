import * as Effect from 'effect/Effect';
import { history, undoDepth } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';

import { type MetadataEdit } from '../../models';
import { getDocFrontMatter } from '../front-matter';
import { schema } from '../schema';
import { para, runCommand } from '../test-utils';
import { editMetadata, setFrontMatter } from './commands';
import { metadataEditingPlugin } from './plugin';

const doc = schema.node('doc', { frontMatter: 'draft: true\n' }, [
  para('The body.'),
]);

describe('setFrontMatter', () => {
  it('sets the front matter, outside the undo history', () => {
    const state = EditorState.create({ doc, plugins: [history()] });

    const { next } = runCommand({
      state,
      command: setFrontMatter('draft: false\n'),
    });

    expect(getDocFrontMatter(next.doc)).toBe('draft: false\n');
    expect(undoDepth(next)).toBe(0);
  });
});

describe('editMetadata', () => {
  const setDraft: MetadataEdit = {
    type: 'setBoolean',
    key: 'draft',
    value: false,
  };

  it('applies where the plugin is installed', () => {
    const state = EditorState.create({
      doc,
      plugins: [
        metadataEditingPlugin({
          normalizeFrontMatter: Effect.succeed,
          onError: () => {},
        }),
      ],
    });

    expect(editMetadata(setDraft)(state)).toBe(true);
  });

  it("doesn't apply where the plugin isn't installed", () => {
    const state = EditorState.create({ doc });

    expect(editMetadata(setDraft)(state)).toBe(false);
  });
});
