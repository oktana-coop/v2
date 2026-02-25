import { blockTypes, HeadingType } from '../constants/blocks';

export const getHeadingLevel = (type: HeadingType): number => {
  switch (type) {
    case blockTypes.HEADING_1:
      return 1;
    case blockTypes.HEADING_2:
      return 2;
    case blockTypes.HEADING_3:
      return 3;
    case blockTypes.HEADING_4:
      return 4;
    case blockTypes.HEADING_5:
      return 5;
    case blockTypes.HEADING_6:
      return 6;
  }
};
