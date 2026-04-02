export const themes = {
  system: 'system',
  light: 'light',
  dark: 'dark',
} as const;

export type Theme = keyof typeof themes;

export type ResolvedTheme = Exclude<Theme, 'system'>;
