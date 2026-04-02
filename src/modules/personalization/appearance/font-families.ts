export const bundledFonts = ['Noto Sans', 'Montserrat'] as const;

export const extractSystemFontFamilies = ({
  fontData,
  bundledFontFamilies = bundledFonts,
}: {
  fontData: FontData[];
  bundledFontFamilies?: readonly string[];
}): string[] => {
  const systemFontFamilies = Array.from(
    new Set(fontData.map((f) => f.family))
  ).sort();
  const bundledSet = new Set<string>(bundledFontFamilies);
  return systemFontFamilies.filter((family) => !bundledSet.has(family));
};
