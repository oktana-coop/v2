/**
 * Hash a file path to a stable 32-bit unsigned integer.
 * This can be used as the `ino` value in a virtual filesystem.
 *
 * Uses FNV-1a 32-bit, pure JS, no dependencies.
 *
 * @param path - normalized path (POSIX style recommended)
 * @returns unsigned 32-bit integer
 */
export function hashPathToIno(path: string): number {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < path.length; i++) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // convert to unsigned 32-bit
}
