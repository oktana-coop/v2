export const sortObjectKeys = <T extends Record<string, unknown>>(
  obj: T
): T => {
  return Object.keys(obj)
    .sort()
    .reduce((sortedObj: T, key: string) => {
      (sortedObj as Record<string, unknown>)[key] = obj[key];
      return sortedObj;
    }, {} as T);
};

const keySortReplacer = (_: string, value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sortObjectKeys(value as Record<string, unknown>);
  }
  return value;
};

export const sortKeysAndStrinfigy = (obj: object) =>
  JSON.stringify(obj, keySortReplacer);
