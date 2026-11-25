import * as Effect from 'effect/Effect';
import { history, undoDepth } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { promiseWithResolvers } from '../../../../../utils/test-utils';
import {
  InvalidMetadataErrorTag,
  RepresentationTransformError,
  UnrepresentableContentError,
} from '../../errors';
import { type MetadataEdit } from '../../models';
import { getDocFrontMatter } from '../front-matter';
import { schema } from '../schema';
import { para } from '../test-utils';
import { editMetadata, redoMetadataEdit, undoMetadataEdit } from './commands';
import {
  metadataEditingPlugin,
  type MetadataEditingPluginArgs,
} from './plugin';
import { getMetadataEditFailures } from './state';

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

const runUndo = (view: EditorView) =>
  undoMetadataEdit(view.state, view.dispatch);

const runRedo = (view: EditorView) =>
  redoMetadataEdit(view.state, view.dispatch);

// Another change reaching the front matter, e.g. a peer's.
const setOtherFrontMatter = ({
  view,
  frontMatter,
}: {
  view: EditorView;
  frontMatter: string;
}) => {
  view.dispatch(view.state.tr.setDocAttribute('frontMatter', frontMatter));
};

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

  it("keeps the failure of an edit the front matter can't take, without normalizing it", async () => {
    const normalizeFrontMatter = vi.fn<NormalizeFrontMatter>();
    const onError = vi.fn<MetadataEditingPluginArgs['onError']>();
    const view = viewWith({
      frontMatter: 'title: [unclosed\n',
      normalizeFrontMatter,
      onError,
    });
    const edit = setBoolean({ key: 'draft', value: false });

    runEditMetadata({ view, edit });

    await eventually(() =>
      expect(getMetadataEditFailures(view.state).get('draft')).toEqual({
        edit,
        error: expect.objectContaining({ _tag: InvalidMetadataErrorTag }),
      })
    );
    expect(normalizeFrontMatter).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(frontMatterOf(view)).toBe('title: [unclosed\n');
  });

  it("keeps the failure of an edit whose content the editor can't show, for its property", async () => {
    const error = new UnrepresentableContentError(
      "The document has content ProseMirror can't represent: math",
      { content: ['math'] }
    );
    const onError = vi.fn<MetadataEditingPluginArgs['onError']>();
    const view = viewWith({
      frontMatter: 'title: Hello\n',
      normalizeFrontMatter: () => Effect.fail(error),
      onError,
    });
    const edit: MetadataEdit = {
      type: 'setInlines',
      key: 'title',
      base: 'Hello',
      value: '$x^2$',
    };

    runEditMetadata({ view, edit });

    await eventually(() =>
      expect(getMetadataEditFailures(view.state).get('title')).toEqual({
        edit,
        error,
      })
    );
    expect(onError).not.toHaveBeenCalled();
    expect(frontMatterOf(view)).toBe('title: Hello\n');
  });

  it("clears the property's failure when a later edit of it is committed", async () => {
    const error = new UnrepresentableContentError(
      "The document has content ProseMirror can't represent: math",
      { content: ['math'] }
    );
    const view = viewWith({
      frontMatter: 'title: Hello\n',
      normalizeFrontMatter: vi
        .fn<NormalizeFrontMatter>()
        .mockReturnValueOnce(Effect.fail(error))
        .mockImplementation(unchanged),
    });

    runEditMetadata({
      view,
      edit: { type: 'setInlines', key: 'title', base: 'Hello', value: '$x^2$' },
    });
    runEditMetadata({
      view,
      edit: { type: 'setInlines', key: 'title', base: 'Hello', value: 'Hi' },
    });

    await eventually(() => expect(frontMatterOf(view)).toBe('title: "Hi"\n'));
    expect(getMetadataEditFailures(view.state).has('title')).toBe(false);
  });

  describe('undo and redo', () => {
    it('undoes the last commit, keeping it out of the undo history', async () => {
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter: unchanged,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'published', value: true }),
      });
      runUndo(view);

      await eventually(() =>
        expect(frontMatterOf(view)).toBe('draft: false\n')
      );
      expect(undoDepth(view.state)).toBe(0);
    });

    it('keeps a change made to the front matter since the commit it undoes', async () => {
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter: unchanged,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      await eventually(() =>
        expect(frontMatterOf(view)).toBe('draft: false\n')
      );

      setOtherFrontMatter({
        view,
        frontMatter: 'title: Other\ndraft: false\n',
      });
      runUndo(view);

      await eventually(() =>
        expect(frontMatterOf(view)).toBe('title: Other\ndraft: true\n')
      );
    });

    it('redoes what was undone, keeping a change made since', async () => {
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter: unchanged,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      runUndo(view);
      await eventually(() => expect(frontMatterOf(view)).toBe('draft: true\n'));

      setOtherFrontMatter({ view, frontMatter: 'title: Other\ndraft: true\n' });
      runRedo(view);

      await eventually(() =>
        expect(frontMatterOf(view)).toBe('title: Other\ndraft: false\n')
      );
    });

    it('undoes once the commits before it are done', async () => {
      const second = pendingNormalization();
      const normalizeFrontMatter = vi
        .fn<NormalizeFrontMatter>()
        .mockImplementationOnce(unchanged)
        .mockReturnValueOnce(second.normalized)
        .mockImplementation(unchanged);
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'published', value: true }),
      });
      await eventually(() =>
        expect(normalizeFrontMatter).toHaveBeenCalledTimes(2)
      );

      runUndo(view);
      second.resolve('draft: false\npublished: true\n');

      await eventually(() =>
        expect(normalizeFrontMatter).toHaveBeenCalledTimes(3)
      );
      await eventually(() =>
        expect(frontMatterOf(view)).toBe('draft: false\n')
      );
    });

    it("doesn't redo what was undone once another edit is committed", async () => {
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter: unchanged,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      runUndo(view);
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'published', value: true }),
      });
      runRedo(view);
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'archived', value: true }),
      });

      await eventually(() =>
        expect(frontMatterOf(view)).toBe(
          'draft: true\npublished: true\narchived: true\n'
        )
      );
    });

    it('changes nothing when there is nothing to undo', async () => {
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter: unchanged,
      });

      runUndo(view);
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'published', value: true }),
      });

      await eventually(() =>
        expect(frontMatterOf(view)).toBe('draft: true\npublished: true\n')
      );
    });

    it('reports an undo that fails and drops its change, so the next undo reverses the one before', async () => {
      const failure = new RepresentationTransformError('normalization failed');
      const normalizeFrontMatter = vi
        .fn<NormalizeFrontMatter>()
        .mockImplementationOnce(unchanged)
        .mockImplementationOnce(unchanged)
        .mockReturnValueOnce(Effect.fail(failure))
        .mockImplementation(unchanged);
      const onError = vi.fn<MetadataEditingPluginArgs['onError']>();
      const view = viewWith({
        frontMatter: 'draft: true\n',
        normalizeFrontMatter,
        onError,
      });

      runEditMetadata({
        view,
        edit: setBoolean({ key: 'draft', value: false }),
      });
      runEditMetadata({
        view,
        edit: setBoolean({ key: 'published', value: true }),
      });
      runUndo(view);
      runUndo(view);

      await eventually(() =>
        expect(frontMatterOf(view)).toBe('draft: true\npublished: true\n')
      );
      expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    });
  });
});
