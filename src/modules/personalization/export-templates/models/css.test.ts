import { describe, expect, it } from 'vitest';

import { exportTemplateToCss } from './css';
import {
  type BlockquoteStyle,
  type BulletListStyle,
  type ExportTemplate,
  type NumberFormat,
  type OrderedListStyle,
  type PageNumberAlignment,
} from './export-template';
import { defaultExportTemplate } from './export-template';

/** Creates a template with a partial style override. */
const withStyles = (
  patch: Partial<ExportTemplate['styles']>
): ExportTemplate => ({
  ...defaultExportTemplate,
  styles: { ...defaultExportTemplate.styles, ...patch },
});

describe('cssLineHeight', () => {
  it('converts "auto" to "normal"', () => {
    const template = withStyles({
      paragraph: {
        ...defaultExportTemplate.styles.paragraph,
        lineHeight: 'auto',
      },
    });
    const css = exportTemplateToCss(template);
    expect(css).toContain('line-height: normal');
  });

  it('passes numeric values through', () => {
    const template = withStyles({
      paragraph: {
        ...defaultExportTemplate.styles.paragraph,
        lineHeight: '2',
      },
    });
    const css = exportTemplateToCss(template);
    expect(css).toContain('line-height: 2');
  });
});

describe('cssLetterSpacing', () => {
  it('converts "auto" to "normal"', () => {
    const css = exportTemplateToCss(defaultExportTemplate);
    // Default letterSpacing is 'auto'
    expect(css).toContain('letter-spacing: normal');
  });

  it('appends "px" to numeric values', () => {
    const template = withStyles({
      paragraph: {
        ...defaultExportTemplate.styles.paragraph,
        letterSpacing: '2',
      },
    });
    const css = exportTemplateToCss(template);
    expect(css).toContain('letter-spacing: 2px');
  });
});

describe('cssTextAlign for lists', () => {
  it('adds text-align-last: left when justify is used', () => {
    const template = withStyles({
      unorderedList: {
        ...defaultExportTemplate.styles.unorderedList,
        textAlignment: 'justify',
      },
    });
    const css = exportTemplateToCss(template);
    expect(css).toContain('text-align: justify');
    expect(css).toContain('text-align-last: left');
  });

  it('uses plain text-align for non-justify alignments', () => {
    const template = withStyles({
      orderedList: {
        ...defaultExportTemplate.styles.orderedList,
        textAlignment: 'center',
      },
    });
    const css = exportTemplateToCss(template);
    expect(css).toMatch(/ol \{[^}]*text-align: center/s);
    expect(css).not.toMatch(/ol \{[^}]*text-align-last/s);
  });
});

describe('blockquoteCss', () => {
  const blockquoteWith = (patch: Partial<BlockquoteStyle>): ExportTemplate =>
    withStyles({
      blockquote: { ...defaultExportTemplate.styles.blockquote, ...patch },
    });

  it('sets padding-left to 0 when borderLeftWidth is 0', () => {
    const css = exportTemplateToCss(blockquoteWith({ borderLeftWidth: 0 }));
    expect(css).toMatch(/blockquote \{[^}]*padding-left: 0[^p]/s);
  });

  it('sets padding-left to 12pt when borderLeftWidth is non-zero', () => {
    const css = exportTemplateToCss(blockquoteWith({ borderLeftWidth: 3 }));
    expect(css).toMatch(/blockquote \{[^}]*padding-left: 12pt/s);
  });
});

describe('codeBlockCss', () => {
  it('includes background-color, padding, and white-space', () => {
    const css = exportTemplateToCss(defaultExportTemplate);
    expect(css).toMatch(/pre \{[^}]*background-color: #f5f5f5/s);
    expect(css).toMatch(/pre \{[^}]*padding: 8pt/s);
    expect(css).toMatch(/pre \{[^}]*white-space: pre-wrap/s);
  });
});

describe('listCss', () => {
  const ulWith = (patch: Partial<BulletListStyle>): ExportTemplate =>
    withStyles({
      unorderedList: {
        ...defaultExportTemplate.styles.unorderedList,
        ...patch,
      },
    });

  const olWith = (patch: Partial<OrderedListStyle>): ExportTemplate =>
    withStyles({
      orderedList: {
        ...defaultExportTemplate.styles.orderedList,
        ...patch,
      },
    });

  it('uses the configured list-style-type for bullet lists', () => {
    const css = exportTemplateToCss(ulWith({ listStyleType: 'circle' }));
    expect(css).toMatch(/ul \{[^}]*list-style-type: circle/s);
  });

  it('uses the configured list-style-type for ordered lists', () => {
    const css = exportTemplateToCss(olWith({ listStyleType: 'lower-alpha' }));
    expect(css).toMatch(/ol \{[^}]*list-style-type: lower-alpha/s);
  });

  it('converts indentation to pt', () => {
    const css = exportTemplateToCss(ulWith({ indentation: 36 }));
    expect(css).toMatch(/ul \{[^}]*padding-left: 36pt/s);
  });
});

describe('pageMarginBox positions', () => {
  const withPageNumbers = (
    position: 'header' | 'footer',
    alignment: PageNumberAlignment
  ): ExportTemplate => ({
    ...defaultExportTemplate,
    pageSetup: {
      ...defaultExportTemplate.pageSetup,
      pageNumbers: {
        enabled: true,
        position,
        alignment,
        showOnFirstPage: true,
        format: { numberFormat: 'decimal' },
      },
    },
  });

  it('places page number in @top-left for header/left', () => {
    const css = exportTemplateToCss(withPageNumbers('header', 'left'));
    expect(css).toContain('@top-left');
  });

  it('places page number in @top-right for header/right', () => {
    const css = exportTemplateToCss(withPageNumbers('header', 'right'));
    expect(css).toContain('@top-right');
  });

  it('places page number in @bottom-center for footer/center', () => {
    const css = exportTemplateToCss(withPageNumbers('footer', 'center'));
    expect(css).toContain('@bottom-center');
  });

  it('places page number in @bottom-left for footer/left', () => {
    const css = exportTemplateToCss(withPageNumbers('footer', 'left'));
    expect(css).toContain('@bottom-left');
  });
});

describe('pageNumbersExtraRules', () => {
  const withPageNumbers = (overrides: {
    alignment: PageNumberAlignment;
    showOnFirstPage: boolean;
    numberFormat?: NumberFormat;
  }): ExportTemplate => ({
    ...defaultExportTemplate,
    pageSetup: {
      ...defaultExportTemplate.pageSetup,
      pageNumbers: {
        enabled: true,
        position: 'footer',
        alignment: overrides.alignment,
        showOnFirstPage: overrides.showOnFirstPage,
        format: { numberFormat: overrides.numberFormat ?? 'decimal' },
      },
    },
  });

  it('hides first page number for inside/outside when showOnFirstPage is false', () => {
    const css = exportTemplateToCss(
      withPageNumbers({ alignment: 'outside', showOnFirstPage: false })
    );
    expect(css).toContain('@page :first');
    expect(css).toContain('content: none');
  });

  it('does not hide first page number for inside/outside when showOnFirstPage is true', () => {
    const css = exportTemplateToCss(
      withPageNumbers({ alignment: 'inside', showOnFirstPage: true })
    );
    expect(css).not.toContain('@page :first');
  });

  it('hides first page for fixed alignment when showOnFirstPage is false', () => {
    const css = exportTemplateToCss(
      withPageNumbers({ alignment: 'center', showOnFirstPage: false })
    );
    expect(css).toContain('@page :first');
    expect(css).toContain('content: none');
  });

  it('does not emit extra rules when page numbers are disabled', () => {
    const template: ExportTemplate = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        pageNumbers: {
          ...defaultExportTemplate.pageSetup.pageNumbers,
          enabled: false,
        },
      },
    };
    const css = exportTemplateToCss(template);
    expect(css).not.toContain('@page :left');
    expect(css).not.toContain('@page :right');
    expect(css).not.toContain('@page :first');
  });
});
