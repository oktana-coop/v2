export type LinkAttrs = { title: string; href: string };

export const isValidURL = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch (err) {
    return false;
  }
};
