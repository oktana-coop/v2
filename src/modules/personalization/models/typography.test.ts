import {
  fontWeightSchema,
  hexColorSchema,
  integerStringSchema,
  letterSpacingSchema,
  lineHeightSchema,
  textAlignmentSchema,
} from './typography';

describe('integerStringSchema', () => {
  it.each(['0', '1', '12', '100'])('accepts "%s"', (value) => {
    expect(integerStringSchema.safeParse(value).success).toBe(true);
  });

  it.each(['', 'abc', '12px', '-1', '0.5', '1.15', '.5', '1.'])(
    'rejects "%s"',
    (value) => {
      expect(integerStringSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe('hexColorSchema', () => {
  it.each(['#000000', '#ffffff', '#FF00AA', '#abcdef'])(
    'accepts "%s"',
    (value) => {
      expect(hexColorSchema.safeParse(value).success).toBe(true);
    }
  );

  it.each(['000000', '#fff', '#GGGGGG', '#12345', '#1234567', '', 'red'])(
    'rejects "%s"',
    (value) => {
      expect(hexColorSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe('fontWeightSchema', () => {
  it.each(['300', '400', '500', '600', '700'])('accepts "%s"', (value) => {
    expect(fontWeightSchema.safeParse(value).success).toBe(true);
  });

  it.each(['100', '200', '800', '900', 'bold', ''])('rejects "%s"', (value) => {
    expect(fontWeightSchema.safeParse(value).success).toBe(false);
  });
});

describe('lineHeightSchema', () => {
  it.each(['auto', '1', '1.15', '1.25', '1.5', '1.75', '2'])(
    'accepts "%s"',
    (value) => {
      expect(lineHeightSchema.safeParse(value).success).toBe(true);
    }
  );

  it.each(['0', '3', 'normal', ''])('rejects "%s"', (value) => {
    expect(lineHeightSchema.safeParse(value).success).toBe(false);
  });
});

describe('letterSpacingSchema', () => {
  it.each(['auto', '0', '0.5', '1', '1.5', '2'])('accepts "%s"', (value) => {
    expect(letterSpacingSchema.safeParse(value).success).toBe(true);
  });

  it.each(['3', 'normal', ''])('rejects "%s"', (value) => {
    expect(letterSpacingSchema.safeParse(value).success).toBe(false);
  });
});

describe('textAlignmentSchema', () => {
  it.each(['left', 'center', 'right', 'justify'])('accepts "%s"', (value) => {
    expect(textAlignmentSchema.safeParse(value).success).toBe(true);
  });

  it.each(['start', 'end', ''])('rejects "%s"', (value) => {
    expect(textAlignmentSchema.safeParse(value).success).toBe(false);
  });
});
