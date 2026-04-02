import { extractSystemFontFamilies } from './font-families';

const makeFontData = (family: string): FontData => ({
  family,
  fullName: family,
  postscriptName: family,
  style: 'Regular',
});

describe('extractSystemFontFamilies', () => {
  it('should return an empty array when given no fonts', () => {
    expect(extractSystemFontFamilies({ fontData: [] })).toEqual([]);
  });

  it('should deduplicate font families', () => {
    const fontData = [
      makeFontData('Arial'),
      { ...makeFontData('Arial'), fullName: 'Arial Bold', style: 'Bold' },
      makeFontData('Helvetica'),
    ];

    expect(extractSystemFontFamilies({ fontData })).toEqual([
      'Arial',
      'Helvetica',
    ]);
  });

  it('should sort families alphabetically', () => {
    const fontData = [
      makeFontData('Zapfino'),
      makeFontData('Arial'),
      makeFontData('Courier'),
    ];

    expect(extractSystemFontFamilies({ fontData })).toEqual([
      'Arial',
      'Courier',
      'Zapfino',
    ]);
  });

  it('should exclude bundled fonts by default (Noto Sans, Montserrat)', () => {
    const fontData = [
      makeFontData('Arial'),
      makeFontData('Noto Sans'),
      makeFontData('Montserrat'),
      makeFontData('Helvetica'),
    ];

    expect(extractSystemFontFamilies({ fontData })).toEqual([
      'Arial',
      'Helvetica',
    ]);
  });

  it('should exclude custom bundled fonts when provided', () => {
    const fontData = [
      makeFontData('Arial'),
      makeFontData('Roboto'),
      makeFontData('Helvetica'),
    ];

    expect(
      extractSystemFontFamilies({
        fontData,
        bundledFontFamilies: ['Roboto'],
      })
    ).toEqual(['Arial', 'Helvetica']);
  });
});
