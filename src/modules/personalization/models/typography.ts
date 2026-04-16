import { z } from 'zod';

export const integerStringSchema = z.string().regex(/^\d+$/);

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const fontWeights = ['300', '400', '500', '600', '700'] as const;
export const fontWeightSchema = z.enum(fontWeights);
export type FontWeight = z.infer<typeof fontWeightSchema>;

export const lineHeights = [
  'auto',
  '1',
  '1.15',
  '1.25',
  '1.5',
  '1.75',
  '2',
] as const;
export const lineHeightSchema = z.enum(lineHeights);
export type LineHeight = z.infer<typeof lineHeightSchema>;

export const letterSpacings = ['auto', '0', '0.5', '1', '1.5', '2'] as const;
export const letterSpacingSchema = z.enum(letterSpacings);
export type LetterSpacing = z.infer<typeof letterSpacingSchema>;

export const textAlignments = ['left', 'center', 'right', 'justify'] as const;
export const textAlignmentSchema = z.enum(textAlignments);
export type TextAlignment = z.infer<typeof textAlignmentSchema>;
