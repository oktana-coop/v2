import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../../errors';
import {
  fontWeightSchema,
  hexColorSchema,
  letterSpacingSchema,
  lineHeightSchema,
  textAlignmentSchema,
} from '../../models';
import { mmToPx } from './units';

const ptSchema = z.number().nonnegative();

const paperSizeSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

export const orientations = ['portrait', 'landscape'] as const;
const orientationSchema = z.enum(orientations);

const marginsSchema = z.object({
  top: z.number(),
  bottom: z.number(),
  left: z.number(),
  right: z.number(),
});

export const pageNumberAlignments = [
  'left',
  'center',
  'right',
  'inside',
  'outside',
] as const;
const pageNumberAlignmentSchema = z.enum(pageNumberAlignments);

export const pageNumberPositions = ['header', 'footer'] as const;
const pageNumberPositionSchema = z.enum(pageNumberPositions);

export const numberFormats = [
  'decimal',
  'lower-roman',
  'upper-roman',
  'lower-alpha',
  'upper-alpha',
] as const;
const numberFormatSchema = z.enum(numberFormats);

const pageNumberFormatSchema = z.object({
  numberFormat: numberFormatSchema,
});

const pageNumbersSchema = z.object({
  enabled: z.boolean(),
  position: pageNumberPositionSchema,
  alignment: pageNumberAlignmentSchema,
  showOnFirstPage: z.boolean(),
  format: pageNumberFormatSchema,
});

const pageSetupSchema = z.object({
  paperSize: paperSizeSchema,
  orientation: orientationSchema,
  margins: marginsSchema,
  pageNumbers: pageNumbersSchema,
});

export type PaperSize = z.infer<typeof paperSizeSchema>;
export type Orientation = z.infer<typeof orientationSchema>;
export type Margins = z.infer<typeof marginsSchema>;
export type PageNumberAlignment = z.infer<typeof pageNumberAlignmentSchema>;
export type PageNumberPosition = z.infer<typeof pageNumberPositionSchema>;
export type NumberFormat = z.infer<typeof numberFormatSchema>;
export type PageNumbers = z.infer<typeof pageNumbersSchema>;
export type PageSetup = z.infer<typeof pageSetupSchema>;

export const paperSizePresets: Record<string, PaperSize> = {
  a4: { name: 'A4', width: 210, height: 297 },
  a5: { name: 'A5', width: 148, height: 210 },
  letter: { name: 'Letter', width: 215.9, height: 279.4 },
  legal: { name: 'Legal', width: 215.9, height: 355.6 },
};

const baseBlockStyleSchema = z.object({
  fontFamily: z.string(),
  fontWeight: fontWeightSchema,
  fontSize: ptSchema,
  color: hexColorSchema,
  lineHeight: lineHeightSchema,
  letterSpacing: letterSpacingSchema,
  textAlignment: textAlignmentSchema,
  spaceBefore: ptSchema,
  spaceAfter: ptSchema,
});

const paragraphStyleSchema = baseBlockStyleSchema.extend({
  firstLineIndent: ptSchema,
});

const codeBlockStyleSchema = baseBlockStyleSchema.extend({
  backgroundColor: hexColorSchema,
  padding: ptSchema,
});

export const bulletListStyleTypes = ['disc', 'circle', 'square'] as const;
const bulletListStyleTypeSchema = z.enum(bulletListStyleTypes);

export const orderedListStyleTypes = [
  'decimal',
  'lower-alpha',
  'lower-roman',
  'upper-alpha',
  'upper-roman',
] as const;
const orderedListStyleTypeSchema = z.enum(orderedListStyleTypes);

const bulletListStyleSchema = baseBlockStyleSchema.extend({
  listStyleType: bulletListStyleTypeSchema,
  indentation: ptSchema,
});

const orderedListStyleSchema = baseBlockStyleSchema.extend({
  listStyleType: orderedListStyleTypeSchema,
  indentation: ptSchema,
});

const blockquoteStyleSchema = baseBlockStyleSchema.extend({
  borderLeftWidth: ptSchema,
  borderLeftColor: hexColorSchema,
  marginLeft: ptSchema,
});

export const textDecorations = ['underline', 'none'] as const;
const textDecorationSchema = z.enum(textDecorations);

const linkStyleSchema = z.object({
  color: hexColorSchema,
  textDecoration: textDecorationSchema,
});

const horizontalRuleStyleSchema = z.object({
  borderWidth: ptSchema,
  borderColor: hexColorSchema,
  spaceBefore: ptSchema,
  spaceAfter: ptSchema,
});

const inlineCodeStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: ptSchema,
  color: hexColorSchema,
  backgroundColor: hexColorSchema,
});

const defaultLinkStyle: z.infer<typeof linkStyleSchema> = {
  color: '#1a0dab',
  textDecoration: 'underline',
};

const defaultInlineCodeStyle: z.infer<typeof inlineCodeStyleSchema> = {
  fontFamily: 'Fira Code',
  fontSize: 10,
  color: '#000000',
  backgroundColor: '#f5f5f5',
};

const defaultHorizontalRuleStyle: z.infer<typeof horizontalRuleStyleSchema> = {
  borderWidth: 1,
  borderColor: '#cccccc',
  spaceBefore: 12,
  spaceAfter: 12,
};

const exportTemplateStylesSchema = z.object({
  paragraph: paragraphStyleSchema,
  heading1: baseBlockStyleSchema,
  heading2: baseBlockStyleSchema,
  heading3: baseBlockStyleSchema,
  heading4: baseBlockStyleSchema,
  heading5: baseBlockStyleSchema,
  heading6: baseBlockStyleSchema,
  codeBlock: codeBlockStyleSchema,
  unorderedList: bulletListStyleSchema,
  orderedList: orderedListStyleSchema,
  blockquote: blockquoteStyleSchema,
  horizontalRule: horizontalRuleStyleSchema,
  link: linkStyleSchema.default(defaultLinkStyle),
  inlineCode: inlineCodeStyleSchema.default(defaultInlineCodeStyle),
});

const exportTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  styles: exportTemplateStylesSchema,
  pageSetup: pageSetupSchema,
});

export const exportTemplatePreferencesSchema = z.object({
  activeTemplateId: z.string(),
  templates: z.array(exportTemplateSchema),
});

export type BulletListStyleType = z.infer<typeof bulletListStyleTypeSchema>;
export type OrderedListStyleType = z.infer<typeof orderedListStyleTypeSchema>;
export type TextDecoration = z.infer<typeof textDecorationSchema>;
export type BaseBlockStyle = z.infer<typeof baseBlockStyleSchema>;
export type ParagraphStyle = z.infer<typeof paragraphStyleSchema>;
export type CodeBlockStyle = z.infer<typeof codeBlockStyleSchema>;
export type BulletListStyle = z.infer<typeof bulletListStyleSchema>;
export type OrderedListStyle = z.infer<typeof orderedListStyleSchema>;
export type BlockquoteStyle = z.infer<typeof blockquoteStyleSchema>;
export type HorizontalRuleStyle = z.infer<typeof horizontalRuleStyleSchema>;
export type LinkStyle = z.infer<typeof linkStyleSchema>;
export type InlineCodeStyle = z.infer<typeof inlineCodeStyleSchema>;
export type ExportTemplateStyles = z.infer<typeof exportTemplateStylesSchema>;
export type ExportTemplate = z.infer<typeof exportTemplateSchema>;
export type ExportTemplatePreferences = z.infer<
  typeof exportTemplatePreferencesSchema
>;

export const parseExportTemplatePreferences = (data: unknown) =>
  Effect.try({
    try: () => exportTemplatePreferencesSchema.parse(data),
    catch: mapErrorTo(ValidationError, 'Invalid export template preferences'),
  });

export const defaultPageSetup: PageSetup = {
  paperSize: { name: 'A4', width: 210, height: 297 },
  orientation: 'portrait',
  margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
  pageNumbers: {
    enabled: false,
    position: 'footer',
    alignment: 'center',
    showOnFirstPage: true,
    format: { numberFormat: 'decimal' },
  },
};

const defaultBaseBlockStyle: BaseBlockStyle = {
  fontFamily: 'Noto Sans',
  fontWeight: '400',
  fontSize: 12,
  color: '#000000',
  lineHeight: '1.5',
  letterSpacing: 'auto',
  textAlignment: 'left',
  spaceBefore: 0,
  spaceAfter: 8,
};

export const DEFAULT_TEMPLATE_ID = 'default';

export const defaultExportTemplate: ExportTemplate = {
  id: DEFAULT_TEMPLATE_ID,
  name: 'Default Template',
  pageSetup: { ...defaultPageSetup },
  styles: {
    paragraph: { ...defaultBaseBlockStyle, firstLineIndent: 0 },
    heading1: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 24,
      spaceBefore: 24,
      spaceAfter: 12,
    },
    heading2: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 18,
      spaceBefore: 20,
      spaceAfter: 10,
    },
    heading3: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 14,
      spaceBefore: 16,
      spaceAfter: 8,
    },
    heading4: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 12,
      spaceBefore: 12,
      spaceAfter: 6,
    },
    heading5: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 11,
      spaceBefore: 12,
      spaceAfter: 6,
    },
    heading6: {
      ...defaultBaseBlockStyle,
      fontWeight: '700',
      fontSize: 10,
      spaceBefore: 12,
      spaceAfter: 6,
    },
    codeBlock: {
      ...defaultBaseBlockStyle,
      fontFamily: 'Fira Code',
      fontSize: 10,
      backgroundColor: '#f5f5f5',
      padding: 8,
    },
    unorderedList: {
      ...defaultBaseBlockStyle,
      listStyleType: 'disc',
      indentation: 24,
    },
    orderedList: {
      ...defaultBaseBlockStyle,
      listStyleType: 'decimal',
      indentation: 24,
    },
    blockquote: {
      ...defaultBaseBlockStyle,
      borderLeftWidth: 3,
      borderLeftColor: '#cccccc',
      marginLeft: 0,
    },
    horizontalRule: { ...defaultHorizontalRuleStyle },
    link: { ...defaultLinkStyle },
    inlineCode: { ...defaultInlineCodeStyle },
  },
};

export const defaultExportTemplatePreferences: ExportTemplatePreferences = {
  activeTemplateId: DEFAULT_TEMPLATE_ID,
  templates: [defaultExportTemplate],
};

export const getPageWidthPx = (template: ExportTemplate): number => {
  const { paperSize, orientation } = template.pageSetup;
  const widthMm =
    orientation === 'landscape' ? paperSize.height : paperSize.width;
  return mmToPx(widthMm);
};
