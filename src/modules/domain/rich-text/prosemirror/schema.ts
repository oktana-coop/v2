import { next as Automerge } from '@automerge/automerge/slim';
import {
  MappedNodeSpec,
  MappedSchemaSpec,
  SchemaAdapter,
} from '@oktana-coop/automerge-prosemirror';
import {
  DOMOutputSpec,
  Mark,
  MarkSpec,
  Node,
  NodeSpec,
} from 'prosemirror-model';

import {
  bulletList as bulletListClasses,
  codeBlock as codeBlockClasses,
  heading1 as heading1Classes,
  heading2 as heading2Classes,
  heading3 as heading3Classes,
  heading4 as heading4Classes,
  orderedList as orderedListClasses,
  paragraph as paragraphClasses,
} from '../../../../renderer/src/components/editing/blocks';
import { link as linkClasses } from '../../../../renderer/src/components/editing/marks';
import { getLinkAttrsFromDomElement, type LinkAttrs } from '../models/link';

// basics
const blockquoteDOM: DOMOutputSpec = ['blockquote', 0];
const hrDOM: DOMOutputSpec = ['hr'];

// marks
const emDOM: DOMOutputSpec = ['em', 0];
const strongDOM: DOMOutputSpec = ['strong', 0];
const codeDOM: DOMOutputSpec = ['code', 0];

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

// Note: This schema is based on the automerge-prosemirror basic schema
const schema: MappedSchemaSpec = {
  nodes: {
    /// NodeSpec The top level document node.
    doc: {
      content: 'block+',
    } as NodeSpec,

    /// A plain paragraph textblock. Represented in the DOM
    /// as a `<p>` element.
    paragraph: {
      automerge: {
        block: 'paragraph',
      },
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', { class: paragraphClasses }, 0];
      },
    } as NodeSpec,

    unknownBlock: {
      automerge: {
        unknownBlock: true,
      },
      group: 'block',
      content: 'block+',
      parseDOM: [{ tag: 'div', attrs: { 'data-unknown-block': 'true' } }],
      toDOM() {
        return ['div', { 'data-unknown-block': 'true' }, 0];
      },
    },

    /// A blockquote (`<blockquote>`) wrapping one or more blocks.
    blockquote: {
      automerge: {
        block: 'blockquote',
      },
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return blockquoteDOM;
      },
    } as NodeSpec,

    /// A horizontal rule (`<hr>`).
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return hrDOM;
      },
    } as NodeSpec,

    /// A heading textblock, with a `level` attribute that
    /// should hold the number 1 to 6. Parsed and serialized as `<h1>` to
    /// `<h6>` elements.
    heading: {
      automerge: {
        block: 'heading',
        attrParsers: {
          fromAutomerge: (block) => ({ level: block.attrs.level }),
          fromProsemirror: (node) => ({ level: node.attrs.level }),
        },
      },
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
      automerge: {
        block: 'code-block',
      },
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
    } as NodeSpec,

    /// The text node.
    text: {
      group: 'inline',
    } as NodeSpec,

    /// An inline image (`<img>`) node. Supports `src`,
    /// `alt`, and `href` attributes. The latter two default to the empty
    /// string.
    image: {
      automerge: {
        block: 'image',
        isEmbed: true,
        attrParsers: {
          fromAutomerge: (block) => ({
            src: block.attrs.src?.toString() || null,
            alt: block.attrs.alt,
            title: block.attrs.title,
          }),
          fromProsemirror: (node: Node) => ({
            src: new Automerge.RawString(node.attrs.src),
            alt: node.attrs.alt,
            title: node.attrs.title,
          }),
        },
      },
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
    } as MappedNodeSpec,

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
    } as NodeSpec,

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
      automerge: {
        block: {
          within: {
            ordered_list: 'ordered-list-item',
            bullet_list: 'unordered-list-item',
          },
        },
      },
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return liDOM;
      },
      defining: true,
    },

    aside: {
      automerge: {
        block: 'aside',
      },
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'aside' }],
      toDOM() {
        return ['aside', 0];
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
      automerge: {
        markName: 'link',
        parsers: {
          fromAutomerge: (mark: Automerge.MarkValue) => {
            if (typeof mark === 'string') {
              // TODO: Move to link model
              try {
                const value = JSON.parse(mark);
                const linkAttrs: LinkAttrs = {
                  href: value.href || '',
                  title: value.title || '',
                };
                return linkAttrs;
              } catch {
                console.warn('failed to parse link mark as JSON');
              }
            }

            const linkAttrs: LinkAttrs = {
              href: '',
              title: '',
            };
            return linkAttrs;
          },
          fromProsemirror: (mark: Mark) =>
            JSON.stringify({
              href: mark.attrs.href,
              title: mark.attrs.title,
            }),
        },
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
      automerge: {
        markName: 'em',
      },
    } as MarkSpec,

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
      automerge: {
        markName: 'strong',
      },
    } as MarkSpec,

    /// Code font mark. Represented as a `<code>` element.
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return codeDOM;
      },
    } as MarkSpec,
  },
};

export const automergeSchemaAdapter = new SchemaAdapter(schema);
