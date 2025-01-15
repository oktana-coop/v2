import type { ValueOf } from 'type-fest';

const PARAGRAPH = 'PARAGRAPH';
const HEADING_1 = 'HEADING_1';
const HEADING_2 = 'HEADING_2';
const HEADING_3 = 'HEADING_3';
const HEADING_4 = 'HEADING_4';
const CODE_BLOCK = 'CODE_BLOCK';
const BULLET_LIST = 'BULLET_LIST';
const ORDERED_LIST = 'ORDERED_LIST';

export const headingTypes = {
  HEADING_1,
  HEADING_2,
  HEADING_3,
  HEADING_4,
} as const;

export const leafBlockTypes = {
  PARAGRAPH,
  ...headingTypes,
  CODE_BLOCK,
} as const;

export const containerBlockTypes = {
  BULLET_LIST,
  ORDERED_LIST,
} as const;

export const blockTypes = {
  ...leafBlockTypes,
  ...containerBlockTypes,
} as const;

export type BlockType = ValueOf<typeof blockTypes>;
export type HeadingType = ValueOf<typeof headingTypes>;
export type LeafBlockType = ValueOf<typeof leafBlockTypes>;
export type ContainerBlockType = ValueOf<typeof containerBlockTypes>;
