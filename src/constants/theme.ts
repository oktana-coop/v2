export const themes = {
  light: 'light',
  dark: 'dark',
} as const;

export type Theme = keyof typeof themes;
