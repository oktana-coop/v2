import * as Effect from 'effect/Effect';
import { history, undoDepth } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { promiseWithResolvers } from '../../../../../utils/test-utils';
import {
  InvalidMetadataErrorTag,
  RepresentationTransformError,
} from '../../errors';
import { type MetadataEdit } from '../../models';
import { getDocFrontMatter } from '../front-matter';
import { schema } from '../schema';
import { para } from '../test-utils';
import { editMetadata } from './commands';
import {
  metadataEditingPlugin,
  type MetadataEditingPluginArgs,
} from './plugin';

type NormalizeFrontMatter = MetadataEditingPluginArgs['normalizeFrontMatter'];

// A normalization that keeps the front matter as it is.
const unchanged: NormalizeFrontMatter = (frontMatter) =>
  Effect.succeed(frontMatter);

// A normalization that finishes when the test resolves it.
const pendingNormalization = () => {
  const { promise, resolve } = promiseWithResolvers<string | null>();

  return { normalized: Effect.promise(() => promise), resolve };
};

// The plugin commits in the background, where the test can't await it;
// `eventually` polls its assertions until they hold.
const eventually = (assertions: () => void) => vi.waitFor(assertions);

const docWith = (frontMatter: string | null) =>
  schema.node('doc', { frontMatter }, [para('The body.')]);

const viewWith = ({
  frontMatter,
  normalizeFrontMatter,
  onError = vi.fn(),
}: {
  frontMatter: string | null;
  normalizeFrontMatter: NormalizeFrontMatter;
  onError?: MetadataEditingPluginArgs['onError'];
}) => {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({
      doc: docWith(frontMatter),
      plugins: [
        history(),
        metadataEditingPlugin({ normalizeFrontMatter, onError }),
      ],
    }),
  });
  onTestFinished(() => view.destroy());

  return view;
};

const frontMatterOf = (view: EditorView) => getDocFrontMatter(view.state.doc);

const setBoolean = ({
  key,
  value,
}: {
  key: string;
  value: boolean;
}): MetadataEdit => ({ type: 'setBoolean', key, value });

const runEditMetadata = ({
  view,
  edit,
}: {
  view: EditorView;
  edit: MetadataEdit;
}) => editMetadata(edit)(view.state, view.dispatch);

describe('metadataEditingPlugin', () => {
  it('sets the normalized front matter of an edit on the document', async () => {
    const normalizeFrontMatter = vi
      .fn<NormalizeFrontMatter>()
      .mockReturnValue(Effect.succeed('title: Hello\ndraft: false\n'));
    const view = viewWith({
      frontMatter: 'title: Hello\ndraft: true\n',
      normalizeFrontMatter,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });

    await eventually(() =>
      expect(frontMatterOf(view)).toBe('title: Hello\ndraft: false\n')
    );
    expect(normalizeFrontMatter).toHaveBeenCalledWith(
      'title: Hello\ndraft: false\n'
    );
  });

  it('keeps an edit out of the undo history', async () => {
    const view = viewWith({
      frontMatter: 'draft: true\n',
      normalizeFrontMatter: unchanged,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });

    await eventually(() => expect(frontMatterOf(view)).toBe('draft: false\n'));
    expect(undoDepth(view.state)).toBe(0);
  });

  it('commits edits one at a time, each on the front matter the one before left', async () => {
    const first = pendingNormalization();
    const second = pendingNormalization();
    const normalizeFrontMatter = vi
      .fn<NormalizeFrontMatter>()
      .mockReturnValueOnce(first.normalized)
      .mockReturnValueOnce(second.normalized);
    const view = viewWith({
      frontMatter: 'draft: true\n',
      normalizeFrontMatter,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });
    runEditMetadata({
      view,
      edit: setBoolean({ key: 'published', value: true }),
    });

    await eventually(() => expect(normalizeFrontMatter).toHaveBeenCalledOnce());

    first.resolve('draft: false\n');

    await eventually(() =>
      expect(normalizeFrontMatter).toHaveBeenLastCalledWith(
        'draft: false\npublished: true\n'
      )
    );

    second.resolve('draft: false\npublished: true\n');

    await eventually(() =>
      expect(frontMatterOf(view)).toBe('draft: false\npublished: true\n')
    );
  });

  it('applies an edit again when the front matter changed while it was normalized', async () => {
    const first = pendingNormalization();
    const normalizeFrontMatter = vi
      .fn<NormalizeFrontMatter>()
      .mockReturnValueOnce(first.normalized)
      .mockImplementation(unchanged);
    const view = viewWith({
      frontMatter: 'draft: true\n',
      normalizeFrontMatter,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });
    await eventually(() => expect(normalizeFrontMatter).toHaveBeenCalledOnce());

    // Another change reaches the front matter meanwhile.
    view.dispatch(
      view.state.tr.setDocAttribute(
        'frontMatter',
        'title: Other\ndraft: true\n'
      )
    );
    first.resolve('draft: false\n');

    await eventually(() =>
      expect(frontMatterOf(view)).toBe('title: Other\ndraft: false\n')
    );
  });

  it('reports an edit that fails, and commits the next one', async () => {
    const failure = new RepresentationTransformError('normalization failed');
    const normalizeFrontMatter = vi
      .fn<NormalizeFrontMatter>()
      .mockReturnValueOnce(Effect.fail(failure))
      .mockImplementation(unchanged);
    const onError = vi.fn<MetadataEditingPluginArgs['onError']>();
    const view = viewWith({
      frontMatter: 'draft: true\n',
      normalizeFrontMatter,
      onError,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });
    runEditMetadata({
      view,
      edit: setBoolean({ key: 'published', value: true }),
    });

    await eventually(() =>
      expect(frontMatterOf(view)).toBe('draft: true\npublished: true\n')
    );
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it("reports an edit the front matter can't take, without normalizing it", async () => {
    const normalizeFrontMatter = vi.fn<NormalizeFrontMatter>();
    const onError = vi.fn<MetadataEditingPluginArgs['onError']>();
    const view = viewWith({
      frontMatter: 'title: [unclosed\n',
      normalizeFrontMatter,
      onError,
    });

    runEditMetadata({ view, edit: setBoolean({ key: 'draft', value: false }) });

    await eventually(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ _tag: InvalidMetadataErrorTag })
      )
    );
    expect(normalizeFrontMatter).not.toHaveBeenCalled();
    expect(frontMatterOf(view)).toBe('title: [unclosed\n');
  });
});
