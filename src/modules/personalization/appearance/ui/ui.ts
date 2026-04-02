export type UIAppearancePreferences = {
  fontFamily: string;
};

export const defaultUIAppearance: UIAppearancePreferences = {
  fontFamily: 'Noto Sans',
};

export const bundledFonts = ['Noto Sans', 'Montserrat'] as const;
