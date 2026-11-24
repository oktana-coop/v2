import * as Effect from 'effect/Effect';
import { history, undoDepth } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';

import { InvalidMetadataError } from '../../errors';
import { type MetadataEdit } from '../../models';
import { getDocFrontMatter } from '../front-matter';
import { schema } from '../schema';
import { para, runCommand } from '../test-utils';
import {
  clearMetadataEditFailure,
  editMetadata,
  setFrontMatter,
} from './commands';
import { metadataEditingPlugin } from './plugin';
import {
  getMetadataEditFailures,
  type MetadataEditingMeta,
  pluginKey,
} from './state';

const doc = schema.node('doc', { frontMatter: 'draft: true\n' }, [
  para('The body.'),
]);

const setDraft: MetadataEdit = {
  type: 'setBoolean',
  key: 'draft',
  value: false,
};

const stateWithPlugin = () =>
  EditorState.create({
    doc,
    plugins: [
      metadataEditingPlugin({
        normalizeFrontMatter: Effect.succeed,
        onError: () => {},
      }),
    ],
  });

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
  it('applies where the plugin is installed', () => {
    expect(editMetadata(setDraft)(stateWithPlugin())).toBe(true);
  });

  it("doesn't apply where the plugin isn't installed", () => {
    const state = EditorState.create({ doc });

    expect(editMetadata(setDraft)(state)).toBe(false);
  });
});

describe('clearMetadataEditFailure', () => {
  it("forgets the property's failed edit", () => {
    const state = stateWithPlugin();
    const failed: MetadataEditingMeta = {
      type: 'failed',
      failure: { edit: setDraft, error: new InvalidMetadataError('Invalid') },
    };
    const withFailure = state.apply(state.tr.setMeta(pluginKey, failed));

    const { handled, next } = runCommand({
      state: withFailure,
      command: clearMetadataEditFailure('draft'),
    });

    expect(handled).toBe(true);
    expect(getMetadataEditFailures(next).has('draft')).toBe(false);
  });

  it("doesn't apply when the property has no failed edit", () => {
    expect(clearMetadataEditFailure('draft')(stateWithPlugin())).toBe(false);
  });
});
