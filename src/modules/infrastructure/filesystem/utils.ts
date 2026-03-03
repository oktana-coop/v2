export const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, '');
};

export const getExtension = (filename: string) => {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1] : '';
};

export const removePath = (filepath: string) => {
  const parts = filepath.split('/');

  const [filename] = parts.slice(-1);

  return filename;
};
