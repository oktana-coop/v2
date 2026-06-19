const toPosixPath = (p: string): string => p.replace(/\\/g, '/');

// Splits a path into POSIX segments, discarding empty parts (leading slashes,
// `//`) and `.` segments. Returns [] for the empty/`./` path.
export const toPosixSegments = (p: string): string[] =>
  toPosixPath(p)
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');
