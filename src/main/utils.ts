export const isElectron = () => {
  return (
    typeof process !== 'undefined' &&
    !!process.versions &&
    !!process.versions.electron
  );
};
