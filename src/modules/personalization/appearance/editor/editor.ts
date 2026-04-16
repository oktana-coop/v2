import { type FontWeight, fontWeights } from '../../models';

const fontWeightLabels: Record<FontWeight, string> = {
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
};

export { type FontWeight };

export const fontWeightOptions = fontWeights.map((value) => ({
  value,
  label: fontWeightLabels[value],
}));

export type HeadingTextSize = 'small' | 'medium' | 'large';

export const headingTextSizeOptions: {
  value: HeadingTextSize;
  label: string;
}[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export const headingTextSizeScale: Record<HeadingTextSize, string> = {
  small: '0.85',
  medium: '1',
  large: '1.15',
};

export type EditorAppearancePreferences = {
  headingFontFamily: string;
  headingFontWeight: FontWeight;
  headingTextSize: HeadingTextSize;
  bodyFontFamily: string;
  matchExportTemplate: boolean;
};

export const defaultEditorAppearance: EditorAppearancePreferences = {
  headingFontFamily: 'Noto Sans',
  headingFontWeight: '700',
  headingTextSize: 'medium',
  bodyFontFamily: 'Noto Sans',
  matchExportTemplate: false,
};
