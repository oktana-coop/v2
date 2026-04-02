export type FontWeight = '300' | '400' | '500' | '600' | '700';

export const fontWeightOptions: { value: FontWeight; label: string }[] = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'SemiBold' },
  { value: '700', label: 'Bold' },
];

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
};

export const defaultEditorAppearance: EditorAppearancePreferences = {
  headingFontFamily: 'Noto Sans',
  headingFontWeight: '700',
  headingTextSize: 'medium',
  bodyFontFamily: 'Noto Sans',
};
