import type { ValueOf } from 'type-fest';

const PARAGRAPH = 'PARAGRAPH';
const HEADING_1 = 'HEADING_1';
const HEADING_2 = 'HEADING_2';
const HEADING_3 = 'HEADING_3';
const HEADING_4 = 'HEADING_4';

export const headingTypes = {
  HEADING_1,
  HEADING_2,
  HEADING_3,
  HEADING_4,
} as const;

export const blockElementTypes = {
  PARAGRAPH,
  ...headingTypes,
} as const;

export type BlockElementType = ValueOf<typeof blockElementTypes>;
export type HeadingType = ValueOf<typeof headingTypes>;
