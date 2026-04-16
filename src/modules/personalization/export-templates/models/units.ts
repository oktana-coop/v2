export const MM_PER_CM = 10;
export const MM_PER_INCH = 25.4;

// https://www.w3.org/TR/css-values-4/#absolute-lengths
export const CSS_PX_PER_INCH = 96;

export const mmToPx = (mm: number): number =>
  mm * (CSS_PX_PER_INCH / MM_PER_INCH);
