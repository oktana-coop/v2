import * as Effect from 'effect/Effect';

import { exportTemplateToCss } from './css';
import {
  defaultExportTemplate,
  defaultExportTemplatePreferences,
  type ExportTemplatePreferences,
  parseExportTemplatePreferences,
} from './export-template';

const validPreferences: ExportTemplatePreferences = {
  ...defaultExportTemplatePreferences,
};

describe('parseExportTemplatePreferences', () => {
  it('parses valid preferences', () => {
    const result = Effect.runSync(
      parseExportTemplatePreferences(validPreferences)
    );
    expect(result).toEqual(validPreferences);
  });

  it('parses preferences with multiple templates', () => {
    const prefs = {
      activeTemplateId: 'custom',
      templates: [
        defaultExportTemplate,
        { ...defaultExportTemplate, id: 'custom', name: 'Custom' },
      ],
    };

    const result = Effect.runSync(parseExportTemplatePreferences(prefs));
    expect(result.templates).toHaveLength(2);
  });

  it('rejects null', () => {
    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(null))
    ).toThrow();
  });

  it('rejects missing templates', () => {
    expect(() =>
      Effect.runSync(
        parseExportTemplatePreferences({ activeTemplateId: 'default' })
      )
    ).toThrow();
  });

  it('rejects missing activeTemplateId', () => {
    expect(() =>
      Effect.runSync(
        parseExportTemplatePreferences({ templates: [defaultExportTemplate] })
      )
    ).toThrow();
  });

  it('rejects invalid font weight in template', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            paragraph: {
              ...defaultExportTemplate.styles.paragraph,
              fontWeight: '999',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid color in template', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            paragraph: {
              ...defaultExportTemplate.styles.paragraph,
              color: 'red',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid fontSize in template', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            paragraph: {
              ...defaultExportTemplate.styles.paragraph,
              fontSize: 'abc',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid lineHeight in template', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            paragraph: {
              ...defaultExportTemplate.styles.paragraph,
              lineHeight: '3',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid bullet list style type', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            unorderedList: {
              ...defaultExportTemplate.styles.unorderedList,
              listStyleType: 'dash',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects missing pageSetup', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          pageSetup: undefined,
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid orientation', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          pageSetup: {
            ...defaultExportTemplate.pageSetup,
            orientation: 'diagonal',
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid page number alignment', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          pageSetup: {
            ...defaultExportTemplate.pageSetup,
            pageNumbers: {
              ...defaultExportTemplate.pageSetup.pageNumbers,
              alignment: 'top',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid ordered list style type', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            orderedList: {
              ...defaultExportTemplate.styles.orderedList,
              listStyleType: 'bullets',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid link text decoration', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            link: {
              ...defaultExportTemplate.styles.link,
              textDecoration: 'strikethrough',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid link color', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            link: {
              ...defaultExportTemplate.styles.link,
              color: 'blue',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('rejects invalid inline code color', () => {
    const invalid = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            inlineCode: {
              ...defaultExportTemplate.styles.inlineCode,
              backgroundColor: 'gray',
            },
          },
        },
      ],
    };

    expect(() =>
      Effect.runSync(parseExportTemplatePreferences(invalid))
    ).toThrow();
  });

  it('backfills missing mark styles with defaults', () => {
    const withoutMarks = {
      ...validPreferences,
      templates: [
        {
          ...defaultExportTemplate,
          styles: {
            ...defaultExportTemplate.styles,
            link: undefined,
            inlineCode: undefined,
          },
        },
      ],
    };

    const result = Effect.runSync(parseExportTemplatePreferences(withoutMarks));
    expect(result.templates[0].styles.link).toEqual(
      defaultExportTemplate.styles.link
    );
    expect(result.templates[0].styles.inlineCode).toEqual(
      defaultExportTemplate.styles.inlineCode
    );
  });
});

describe('defaultExportTemplate', () => {
  it('is valid according to the schema', () => {
    const result = Effect.runSync(
      parseExportTemplatePreferences(defaultExportTemplatePreferences)
    );
    expect(result).toEqual(defaultExportTemplatePreferences);
  });

  it('produces expected default CSS', () => {
    expect(exportTemplateToCss(defaultExportTemplate)).toMatchSnapshot();
  });
});

describe('exportTemplateToCss page setup', () => {
  it('swaps dimensions for landscape orientation', () => {
    const landscape = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        orientation: 'landscape' as const,
      },
    };
    const css = exportTemplateToCss(landscape);
    expect(css).toContain('size: 297mm 210mm');
  });

  it('generates page number CSS for footer center', () => {
    const withPageNumbers = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        pageNumbers: {
          ...defaultExportTemplate.pageSetup.pageNumbers,
          enabled: true,
          position: 'footer' as const,
          alignment: 'center' as const,
        },
      },
    };
    const css = exportTemplateToCss(withPageNumbers);
    expect(css).toContain('@bottom-center');
    expect(css).toContain('content: counter(page)');
  });

  it('generates inside/outside page number rules', () => {
    const withInside = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        pageNumbers: {
          ...defaultExportTemplate.pageSetup.pageNumbers,
          enabled: true,
          position: 'footer' as const,
          alignment: 'inside' as const,
        },
      },
    };
    const css = exportTemplateToCss(withInside);
    expect(css).toContain('@page :left');
    expect(css).toContain('@page :right');
  });

  it('hides page number on first page when showOnFirstPage is false', () => {
    const hidden = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        pageNumbers: {
          ...defaultExportTemplate.pageSetup.pageNumbers,
          enabled: true,
          showOnFirstPage: false,
        },
      },
    };
    const css = exportTemplateToCss(hidden);
    expect(css).toContain('@page :first');
    expect(css).toContain('content: none');
  });

  it('uses counter style for non-decimal formats', () => {
    const roman = {
      ...defaultExportTemplate,
      pageSetup: {
        ...defaultExportTemplate.pageSetup,
        pageNumbers: {
          ...defaultExportTemplate.pageSetup.pageNumbers,
          enabled: true,
          format: { numberFormat: 'lower-roman' as const },
        },
      },
    };
    const css = exportTemplateToCss(roman);
    expect(css).toContain('counter(page, lower-roman)');
  });
});
