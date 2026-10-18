import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, onTestFinished } from 'vitest';

import { mergeConflicts } from './merge-conflicts';

const region = ({ target, source }: { target: string; source: string }) =>
  `<<<<<<< main\n${target}\n=======\n${source}\n>>>>>>> experiment\n`;

const setUpEditor = (text: string) => {
  const view = new EditorView({
    state: EditorState.create({ doc: text, extensions: mergeConflicts }),
    parent: document.body,
  });
  onTestFinished(() => {
    view.destroy();
  });

  return view;
};

const lineClasses = (view: EditorView) =>
  Array.from(view.contentDOM.querySelectorAll('.cm-line')).map((line) =>
    Array.from(line.classList).filter((name) =>
      name.startsWith('cm-mergeConflict')
    )
  );

const actionButtons = (view: EditorView) =>
  Array.from(
    view.contentDOM.querySelectorAll<HTMLButtonElement>(
      '.cm-mergeConflictActions button'
    )
  );

const clickButton = ({
  view,
  text,
  nth = 0,
}: {
  view: EditorView;
  text: string;
  nth?: number;
}) => {
  const button = actionButtons(view).filter(
    (element) => element.textContent === text
  )[nth];
  button.click();
};

describe('mergeConflicts', () => {
  it("colors a region's marker lines and each of its sides", () => {
    const view = setUpEditor(
      `name: v2\n${region({ target: 'version: 1.29', source: 'version: 1.25' })}`
    );

    expect(lineClasses(view)).toEqual([
      [],
      ['cm-mergeConflictMarker'],
      ['cm-mergeConflictTarget'],
      ['cm-mergeConflictMarker'],
      ['cm-mergeConflictSource'],
      ['cm-mergeConflictMarker'],
      [],
    ]);
  });

  it('offers to keep either side, by their labels, or both', () => {
    const view = setUpEditor(region({ target: 'a: 1', source: 'a: 2' }));

    expect(actionButtons(view).map((button) => button.textContent)).toEqual([
      'Keep main',
      'Keep experiment',
      'Keep both',
    ]);
  });

  it("keeps the target's side", () => {
    const view = setUpEditor(
      `name: v2\n${region({ target: 'a: 1', source: 'a: 2' })}b: 0\n`
    );

    clickButton({ view, text: 'Keep main' });

    expect(view.state.doc.toString()).toBe('name: v2\na: 1\nb: 0\n');
  });

  it("keeps the source's side", () => {
    const view = setUpEditor(
      `name: v2\n${region({ target: 'a: 1', source: 'a: 2' })}b: 0\n`
    );

    clickButton({ view, text: 'Keep experiment' });

    expect(view.state.doc.toString()).toBe('name: v2\na: 2\nb: 0\n');
  });

  it('keeps both sides', () => {
    const view = setUpEditor(region({ target: 'a: 1', source: 'a: 2' }));

    clickButton({ view, text: 'Keep both' });

    expect(view.state.doc.toString()).toBe('a: 1\na: 2\n');
  });

  it('resolves only the region whose action was taken', () => {
    const view = setUpEditor(
      `${region({ target: 'a: 1', source: 'a: 2' })}b: 0\n${region({ target: 'c: 1', source: 'c: 2' })}`
    );

    clickButton({ view, text: 'Keep experiment', nth: 1 });

    expect(view.state.doc.toString()).toBe(
      `${region({ target: 'a: 1', source: 'a: 2' })}b: 0\nc: 2\n`
    );
    expect(actionButtons(view)).toHaveLength(3);
  });

  it('stops marking a region once its markers are edited away', () => {
    const view = setUpEditor(region({ target: 'a: 1', source: 'a: 2' }));
    const separator = view.state.doc.line(3);

    view.dispatch({
      changes: { from: separator.from, to: separator.to + 1 },
    });

    expect(actionButtons(view)).toHaveLength(0);
    expect(lineClasses(view).flat()).toEqual([]);
  });
});
