export const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, '');
};
