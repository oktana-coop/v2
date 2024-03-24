import { themes, type Theme } from './theme';

export const getDefaultTheme = () =>
  (localStorage.getItem('theme') ?? themes.light) as Theme;
