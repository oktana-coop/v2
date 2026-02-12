import { Node as PMNode } from 'prosemirror-model';
import { EditorView, type NodeView } from 'prosemirror-view';

import { codeBlock as codeBlockClasses } from '../../../../../renderer/src/components/editing/blocks';
import { codeBlockLanguageNames, codeBlockLanguages } from '../../constants';

const createSelectElement = (initialValue: string) => {
  // Wrapper for select + caret
  const selectWrapper = document.createElement('div');
  selectWrapper.className = 'relative';

  const select = document.createElement('select');
  // Both our selected shiki themes are dark, so we use a dark background for the select to match the highlighted code block.
  // In case we use a light theme in the future, we can switch to a light background and outline when that theme is active.
  select.className =
    'appearance-none w-full rounded-md bg-neutral-900/85 py-0.5 pl-3 pr-8 text-white outline outline-1 -outline-offset-1 outline-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-300 text-sm/6';

  Object.values(codeBlockLanguages).forEach((language) => {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = codeBlockLanguageNames[language];
    select.appendChild(option);
  });

  select.value = initialValue;

  // We are using a custom caret icon because it looks better than the default one.
  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  caret.setAttribute('viewBox', '0 0 20 20');
  caret.setAttribute('fill', 'currentColor');
  caret.classList.add(
    'pointer-events-none',
    'absolute',
    'right-3',
    'top-1/2',
    '-translate-y-1/2',
    'h-4',
    'w-4',
    'text-gray-500'
  );

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
  );

  caret.appendChild(path);

  selectWrapper.appendChild(select);
  selectWrapper.appendChild(caret);

  return {
    select,
    wrapper: selectWrapper,
  };
};

export class CodeBlockView implements NodeView {
  node: PMNode;
  view: EditorView;
  getPos: () => number | undefined;

  dom: HTMLElement;
  header: HTMLElement;
  codeElement: HTMLElement;
  contentDOM: HTMLElement;

  private select: HTMLSelectElement;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // The main container for the code block node view.
    // It contains both the language selector and the actual code block content.
    this.dom = document.createElement('div');
    this.dom.className = `${codeBlockClasses} relative group`;

    // Create the header - hidden by default
    this.header = document.createElement('div');
    this.header.className =
      'code-block-header absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200';

    const { select, wrapper: selectWrapper } = createSelectElement(
      node.attrs.language ?? codeBlockLanguages.PLAINTEXT
    );

    this.select = select;
    this.header.appendChild(selectWrapper);
    this.dom.appendChild(this.header);

    // Create the content DOM (the actual code block)
    this.contentDOM = document.createElement('pre');
    this.contentDOM.spellcheck = false;
    const code = document.createElement('code');
    code.spellcheck = false;
    this.contentDOM.appendChild(code);
    this.dom.appendChild(this.contentDOM);

    this.codeElement = code;
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Prevent ProseMirror from capturing events on the select
    this.select.addEventListener('mousedown', this.stopEventPropagation);
    this.select.addEventListener('mouseup', this.stopEventPropagation);
    this.select.addEventListener('click', this.stopEventPropagation);
    // Handle language changes
    this.select.addEventListener('change', this.handleLanguageChange);
  }

  handleLanguageChange = (ev: Event) => {
    const pos = this.getPos();

    if (pos) {
      const newLanguage = (ev.target as HTMLSelectElement).value;

      const tr = this.view.state.tr.setNodeAttribute(
        pos,
        'language',
        newLanguage
      );
      this.view.dispatch(tr);
    }
  };

  stopEventPropagation(ev: Event) {
    ev.stopPropagation();
  }

  selectNode() {
    // Blur the select when the node is selected to prevent dropdown interference
    this.select.blur();
  }

  stopEvent(ev: Event) {
    // Return true for events on the select element to tell ProseMirror to ignore them
    // The event.stopPropagation() in the listeners should handle it, but this is a safety check
    return this.select.contains(ev.target as Node);
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;

    this.node = node;
    this.select.value = node.attrs.language ?? codeBlockLanguages.PLAINTEXT;

    // Update the code element class
    this.codeElement.className = `language-${node.attrs.language}`;

    return true;
  }

  destroy() {
    this.select.removeEventListener('mousedown', this.stopEventPropagation);
    this.select.removeEventListener('mouseup', this.stopEventPropagation);
    this.select.removeEventListener('click', this.stopEventPropagation);
    this.select.removeEventListener('change', this.handleLanguageChange);
  }
}
