export type LinkAttrs = { title: string; href: string };

export const isValidURL = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

export const ensureHttpPrefix = (str: string) => {
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }
  return `https://${str}`;
};

export const getLinkAttrsFromDomElement = (domElement: HTMLElement) => {
  const attrs: LinkAttrs = {
    href: domElement.getAttribute('href') ?? '',
    title: domElement.getAttribute('title') ?? '',
  };
  return attrs;
};
