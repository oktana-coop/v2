export const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, '');
};

export const removePath = (filepath: string) => {
  const parts = filepath.split('/');

  const [filename] = parts.slice(-1);

  return filename;
};
