// Dedupes a list by value, preserving first-occurrence order.
export const unique = <T>(items: T[]): T[] => Array.from(new Set(items));
