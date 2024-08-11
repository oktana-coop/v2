import { blockElementTypes, HeadingType } from '../constants/blocks';

export const getHeadingLevel = (type: HeadingType): number => {
  switch (type) {
    case blockElementTypes.HEADING_1:
      return 1;
    case blockElementTypes.HEADING_2:
      return 2;
    case blockElementTypes.HEADING_3:
      return 3;
    case blockElementTypes.HEADING_4:
      return 4;
  }
};
