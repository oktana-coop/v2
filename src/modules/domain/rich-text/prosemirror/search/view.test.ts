import { type EditorView } from 'prosemirror-view';

import { scrollActiveSearchMatchIntoView } from './view';

// jsdom does not implement scrollIntoView, so the tests observe it via a stub.
const viewWithDom = (html: string) => {
  const dom = document.createElement('div');
  dom.innerHTML = html;
  return { view: { dom } as unknown as EditorView, dom };
};

describe('scrollActiveSearchMatchIntoView', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('scrolls the active match decoration into view', () => {
    const { view, dom } = viewWithDom(
      '<p>' +
        '<span class="ProseMirror-search-match">hello</span> world ' +
        '<span class="ProseMirror-active-search-match">hello</span>' +
        '</p>'
    );
    // An own-property stub, so the assertion proves the call happened on
    // this element; other elements would hit the shared prototype stub.
    const active = dom.querySelector('.ProseMirror-active-search-match')!;
    active.scrollIntoView = vi.fn();

    scrollActiveSearchMatchIntoView(view);

    expect(active.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('does nothing when there is no active match', () => {
    const { view } = viewWithDom(
      '<p><span class="ProseMirror-search-match">hello</span></p>'
    );
    expect(() => scrollActiveSearchMatchIntoView(view)).not.toThrow();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
