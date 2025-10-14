import { type DOMOutputSpec, Schema, type SchemaSpec } from 'prosemirror-model';

import {
  blockquote as blockquoteClasses,
  bulletList as bulletListClasses,
  codeBlock as codeBlockClasses,
  heading1 as heading1Classes,
  heading2 as heading2Classes,
  heading3 as heading3Classes,
  heading4 as heading4Classes,
  noteContent as noteContentClasses,
  orderedList as orderedListClasses,
  paragraph as paragraphClasses,
} from '../../../../renderer/src/components/editing/blocks';
import { noteRef as noteRefClasses } from '../../../../renderer/src/components/editing/inlines';
import {
  code as codeClasses,
  link as linkClasses,
} from '../../../../renderer/src/components/editing/marks';
import { getLinkAttrsFromDomElement } from '../models/link';

// basics
const blockquoteDOM: DOMOutputSpec = [
  'blockquote',
  { class: blockquoteClasses },
  0,
];
const hrDOM: DOMOutputSpec = ['hr'];

// marks
const emDOM: DOMOutputSpec = ['em', 0];
const strongDOM: DOMOutputSpec = ['strong', 0];
const codeDOM: DOMOutputSpec = [
  'code',
  { class: codeClasses, spellcheck: 'false' },
  0,
];

// lists
const liDOM: DOMOutputSpec = ['li', 0];

const getHeadingLevelClasses = (level: number) => {
  switch (level) {
    case 1:
    default:
      return heading1Classes;
    case 2:
      return heading2Classes;
    case 3:
      return heading3Classes;
    case 4:
      return heading4Classes;
  }
};

const schemaSpec: SchemaSpec = {
  nodes: {
    /// NodeSpec The top level document node.
    doc: {
      content: 'block+',
    },

    /// A plain paragraph textblock. Represented in the DOM
    /// as a `<p>` element.
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', { class: paragraphClasses }, 0];
      },
    },

    unknownBlock: {
      group: 'block',
      content: 'block+',
      parseDOM: [{ tag: 'div', attrs: { 'data-unknown-block': 'true' } }],
      toDOM() {
        return ['div', { 'data-unknown-block': 'true' }, 0];
      },
    },

    /// A blockquote (`<blockquote>`) wrapping one or more blocks.
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return blockquoteDOM;
      },
    },

    /// A horizontal rule (`<hr>`).
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return hrDOM;
      },
    },

    /// A heading textblock, with a `level` attribute that
    /// should hold the number 1 to 6. Parsed and serialized as `<h1>` to
    /// `<h6>` elements.
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
      ],
      toDOM(node) {
        const classes = getHeadingLevelClasses(node.attrs.level);

        return ['h' + node.attrs.level, { class: classes }, 0];
      },
    },

    /// A code listing. Disallows marks or non-text inline
    /// nodes by default. Represented as a `<pre>` element with a
    /// `<code>` element inside of it.
    code_block: {
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() {
        return [
          'pre',
          ['code', { class: codeBlockClasses, spellcheck: 'false' }, 0],
        ];
      },
    },

    /// The text node.
    text: {
      group: 'inline',
    },

    /// An inline image (`<img>`) node. Supports `src`,
    /// `alt`, and `href` attributes. The latter two default to the empty
    /// string.
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute('src'),
              title: dom.getAttribute('title'),
              alt: dom.getAttribute('alt'),
            };
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title } = node.attrs;
        return ['img', { src, alt, title }];
      },
    },

    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs(dom: HTMLElement) {
            return {
              order: dom.hasAttribute('start')
                ? +dom.getAttribute('start')!
                : 1,
            };
          },
        },
      ],
      toDOM(node) {
        return node.attrs.order == 1
          ? ['ol', { class: orderedListClasses }, 0]
          : ['ol', { class: orderedListClasses, start: node.attrs.order }, 0];
      },
    },

    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ['ul', { class: bulletListClasses }, 0];
      },
    },

    /// A list item (`<li>`) spec.
    list_item: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return liDOM;
      },
      defining: true,
    },

    aside: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'aside' }],
      toDOM() {
        return ['aside', 0];
      },
    },

    note_ref: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        id: { default: null },
        href: { default: null },
      },
      parseDOM: [
        {
          tag: 'a.note-ref',
          getAttrs: (dom) => ({
            id: dom.getAttribute('data-id') ?? null,
            href: dom.getAttribute('href') || '',
          }),
        },
      ],
      toDOM(node) {
        if (!node.attrs.id) {
          // Return a placeholder element when no ID is present
          return ['span', { class: `note-ref ${noteRefClasses}` }, 0];
        }

        return [
          'a',
          {
            class: `note-ref ${noteRefClasses}`,
            id: `note-${node.attrs.id}-ref`,
            'data-id': node.attrs.id,
            href: `#note-${node.attrs.id}`,
          },
          String(node.attrs.id),
        ];
      },
    },

    note_content: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: {
        id: { default: null },
      },
      parseDOM: [
        {
          tag: 'div.note-content',
          getAttrs: (dom) => ({
            id: dom.getAttribute('data-id') ?? null,
          }),
        },
      ],
      toDOM(node) {
        if (!node.attrs.id) {
          // Return a placeholder element when no ID is present
          return ['div', { class: `note-content ${noteContentClasses}` }, 0];
        }

        return [
          'div',
          {
            class: `note-content ${noteContentClasses}`,
            'data-id': node.attrs.id,
            id: `note-${node.attrs.id}`,
          },
          0,
        ];
      },
    },
  },
  marks: {
    /// A link. Has `href` and `title` attributes. `title`
    /// defaults to the empty string. Rendered and parsed as an `<a>`
    /// element.
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: getLinkAttrsFromDomElement,
        },
      ],
      toDOM(node) {
        const { href, title } = node.attrs;
        return [
          'a',
          {
            href,
            title,
            class: linkClasses,
          },
          0,
        ];
      },
    },
    /// An emphasis mark. Rendered as an `<em>` element. Has parse rules
    /// that also match `<i>` and `font-style: italic`.
    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style=italic' },
        { style: 'font-style=normal', clearMark: (m) => m.type.name == 'em' },
      ],
      toDOM() {
        return emDOM;
      },
    },
    /// A strong mark. Rendered as `<strong>`, parse rules also match
    /// `<b>` and `font-weight: bold`.
    strong: {
      parseDOM: [
        { tag: 'strong' },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: 'b',
          getAttrs: (node: HTMLElement) =>
            node.style.fontWeight != 'normal' && null,
        },
        { style: 'font-weight=400', clearMark: (m) => m.type.name == 'strong' },
        {
          style: 'font-weight',
          getAttrs: (value: string) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM() {
        return strongDOM;
      },
    },

    /// Code font mark. Represented as a `<code>` element.
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return codeDOM;
      },
    },
  },
};

export const schema = new Schema(schemaSpec);
