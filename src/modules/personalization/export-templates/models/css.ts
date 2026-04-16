import {
  type BaseBlockStyle,
  type BlockquoteStyle,
  type BulletListStyle,
  type CodeBlockStyle,
  type ExportTemplate,
  type HorizontalRuleStyle,
  type InlineCodeStyle,
  type LinkStyle,
  type OrderedListStyle,
  type PageNumbers,
  type PageSetup,
  type ParagraphStyle,
} from './export-template';

const pt = (value: number): string => `${value}pt`;

const cssLineHeight = (value: string): string =>
  value === 'auto' ? 'normal' : value;

const cssLetterSpacing = (value: string): string =>
  value === 'auto' ? 'normal' : `${value}px`;

const baseBlockToCss = ({
  selector,
  style,
  extra = '',
}: {
  selector: string;
  style: BaseBlockStyle;
  extra?: string;
}): string =>
  `${selector} {
    font-family: ${style.fontFamily};
    font-weight: ${style.fontWeight};
    font-size: ${pt(style.fontSize)};
    color: ${style.color};
    line-height: ${cssLineHeight(style.lineHeight)};
    letter-spacing: ${cssLetterSpacing(style.letterSpacing)};
    text-align: ${style.textAlignment};${extra}
  }`;

const headingCss = (selector: string, style: BaseBlockStyle): string =>
  baseBlockToCss({
    selector,
    style,
    extra: `
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};`,
  });

const codeBlockCss = (style: CodeBlockStyle): string =>
  baseBlockToCss({
    selector: 'pre',
    style,
    extra: `
    background-color: ${style.backgroundColor};
    padding: ${pt(style.padding)};
    white-space: pre-wrap;
    break-inside: avoid;`,
  });

/* text-align-last: left prevents justify from stretching short
   single-line list items across the full width. Multi-line items
   still justify on wrapped lines. */
const cssTextAlign = (alignment: string): string =>
  alignment === 'justify'
    ? `text-align: justify;\n    text-align-last: left;`
    : `text-align: ${alignment};`;

const bulletListCss = (style: BulletListStyle): string =>
  `ul {
    list-style-type: ${style.listStyleType};
    list-style-position: outside;
    padding-left: ${pt(style.indentation)};
    margin-left: 0;
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};
    font-family: ${style.fontFamily};
    font-weight: ${style.fontWeight};
    font-size: ${pt(style.fontSize)};
    color: ${style.color};
    line-height: ${cssLineHeight(style.lineHeight)};
    letter-spacing: ${cssLetterSpacing(style.letterSpacing)};
    ${cssTextAlign(style.textAlignment)}
  }`;

const orderedListCss = (style: OrderedListStyle): string =>
  `ol {
    list-style-type: ${style.listStyleType};
    list-style-position: outside;
    padding-left: ${pt(style.indentation)};
    margin-left: 0;
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};
    font-family: ${style.fontFamily};
    font-weight: ${style.fontWeight};
    font-size: ${pt(style.fontSize)};
    color: ${style.color};
    line-height: ${cssLineHeight(style.lineHeight)};
    letter-spacing: ${cssLetterSpacing(style.letterSpacing)};
    ${cssTextAlign(style.textAlignment)}
  }`;

const blockquoteCss = (style: BlockquoteStyle): string =>
  `blockquote {
    border-left: ${pt(style.borderLeftWidth)} solid ${style.borderLeftColor};
    padding-left: ${style.borderLeftWidth === 0 ? '0' : '12pt'};
    margin-left: ${pt(style.marginLeft)};
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};
    font-family: ${style.fontFamily};
    font-weight: ${style.fontWeight};
    font-size: ${pt(style.fontSize)};
    color: ${style.color};
    line-height: ${cssLineHeight(style.lineHeight)};
    letter-spacing: ${cssLetterSpacing(style.letterSpacing)};
    text-align: ${style.textAlignment};
  }`;

const mm = (value: number): string => `${value}mm`;

const pageMarginBox = ({
  position,
  alignment,
}: {
  position: 'header' | 'footer';
  alignment: string;
}): string => {
  const vertical = position === 'header' ? 'top' : 'bottom';
  if (alignment === 'left') return `@${vertical}-left`;
  if (alignment === 'right') return `@${vertical}-right`;
  return `@${vertical}-center`;
};

const pageNumberCounterStyle = (format: string): string => {
  if (format === 'decimal') return '';
  return `, ${format}`;
};

// Returns margin box declarations to embed inside the main @page rule
const pageNumbersInlineCSs = (pageNumbers: PageNumbers): string => {
  if (!pageNumbers.enabled) return '';

  const { position, alignment, format } = pageNumbers;
  const counterStyle = pageNumberCounterStyle(format.numberFormat);
  const content = `counter(page${counterStyle})`;

  if (alignment === 'inside' || alignment === 'outside') {
    // For inside/outside, we can't put both :left and :right in the main @page,
    // so we return nothing here — handled entirely by extra rules.
    return '';
  }

  const box = pageMarginBox({ position, alignment });
  return `\n    ${box} { content: ${content}; }`;
};

// Returns additional @page rules (for :left/:right/:first overrides)
const pageNumbersExtraRules = (pageNumbers: PageNumbers): string => {
  if (!pageNumbers.enabled) return '';

  const { position, alignment, format } = pageNumbers;
  const counterStyle = pageNumberCounterStyle(format.numberFormat);
  const content = `counter(page${counterStyle})`;
  const rules: string[] = [];

  if (alignment === 'inside' || alignment === 'outside') {
    const vertical = position === 'header' ? 'top' : 'bottom';
    // :left pages (even) — inside = right edge, outside = left edge
    // :right pages (odd) — inside = left edge, outside = right edge
    const leftPageBox =
      alignment === 'inside' ? `@${vertical}-right` : `@${vertical}-left`;
    const rightPageBox =
      alignment === 'inside' ? `@${vertical}-left` : `@${vertical}-right`;

    rules.push(
      `@page :left { ${leftPageBox} { content: ${content}; } }`,
      `@page :right { ${rightPageBox} { content: ${content}; } }`
    );

    if (!pageNumbers.showOnFirstPage) {
      rules.push(
        `@page :first { ${leftPageBox} { content: none; } ${rightPageBox} { content: none; } }`
      );
    }
  } else if (!pageNumbers.showOnFirstPage) {
    const box = pageMarginBox({ position, alignment });
    rules.push(`@page :first { ${box} { content: none; } }`);
  }

  return rules.length > 0 ? '\n  ' + rules.join('\n  ') : '';
};

const pageSetupCss = (pageSetup: PageSetup): string => {
  const { paperSize, orientation, margins, pageNumbers } = pageSetup;
  const [width, height] =
    orientation === 'landscape'
      ? [paperSize.height, paperSize.width]
      : [paperSize.width, paperSize.height];

  return `@page {
    size: ${mm(width)} ${mm(height)};
    margin: ${mm(margins.top)} ${mm(margins.right)} ${mm(margins.bottom)} ${mm(margins.left)};${pageNumbersInlineCSs(pageNumbers)}
  }${pageNumbersExtraRules(pageNumbers)}`;
};

const horizontalRuleCss = (style: HorizontalRuleStyle): string =>
  `hr {
    border: none;
    border-top: ${pt(style.borderWidth)} solid ${style.borderColor};
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};
  }`;

const paragraphCss = (style: ParagraphStyle): string =>
  `p {
    font-weight: ${style.fontWeight};
    margin-top: ${pt(style.spaceBefore)};
    margin-bottom: ${pt(style.spaceAfter)};
    text-indent: ${pt(style.firstLineIndent)};
  }`;

const linkCss = (style: LinkStyle): string =>
  `a { color: ${style.color}; text-decoration: ${style.textDecoration}; }`;

const inlineCodeCss = (style: InlineCodeStyle): string =>
  `:not(pre) > code {
    font-family: ${style.fontFamily};
    font-size: ${pt(style.fontSize)};
    color: ${style.color};
    background-color: ${style.backgroundColor};
    padding: 0.2em 0.375em;
    border-radius: 0.25em;
    border: 1px solid #e0e0e0;
  }`;

export const exportTemplateToCss = (template: ExportTemplate): string => {
  const { styles, pageSetup } = template;

  return `
  ${pageSetupCss(pageSetup)}

  /* Reset browser default margins/padding so only the template's
     explicit spacing applies (e.g. heading margin-top would otherwise
     add unexpected space at the top of each page). */
  body, h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote {
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${styles.paragraph.fontFamily};
    font-size: ${pt(styles.paragraph.fontSize)};
    line-height: ${cssLineHeight(styles.paragraph.lineHeight)};
    color: ${styles.paragraph.color};
    letter-spacing: ${cssLetterSpacing(styles.paragraph.letterSpacing)};
    text-align: ${styles.paragraph.textAlignment};
  }

  h1, h2, h3, h4, h5, h6 { break-after: avoid; }
  h1:first-child, h2:first-child, h3:first-child,
  h4:first-child, h5:first-child, h6:first-child { margin-top: 0; }
  ${headingCss('h1', styles.heading1)}
  ${headingCss('h2', styles.heading2)}
  ${headingCss('h3', styles.heading3)}
  ${headingCss('h4', styles.heading4)}
  ${headingCss('h5', styles.heading5)}
  ${headingCss('h6', styles.heading6)}

  ${paragraphCss(styles.paragraph)}

  ${bulletListCss(styles.unorderedList)}
  ${orderedListCss(styles.orderedList)}
  li { line-height: ${cssLineHeight(styles.paragraph.lineHeight)}; }

  ${codeBlockCss(styles.codeBlock)}

  ${inlineCodeCss(styles.inlineCode)}

  ${blockquoteCss(styles.blockquote)}

  ${linkCss(styles.link)}

  img { max-width: 100%; break-inside: avoid; }

  ${horizontalRuleCss(styles.horizontalRule)}

  section.footnotes > hr { display: none; }
`;
};
