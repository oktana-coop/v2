import { type Mode, type ObjectEncodingOptions, type OpenMode } from 'node:fs';

// A small subset of Node's fs.Stats
export type Stats = {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  mode: number;
  ctimeMs: number;
  mtimeMs: number;
  dev: number;
  ino: number;
  uid: number;
  gid: number;
  size: number;
};

export type NodeLikeFsApi = {
  readFile: (
    filepath: string,
    options?:
      | {
          encoding?: null | undefined;
          flag?: string | undefined;
        }
      | null
      | string
  ) => Promise<string | Buffer>;
  writeFile: (
    filepath: string,
    data: Buffer | Uint8Array | string,
    options?:
      | (ObjectEncodingOptions & {
          mode?: Mode | undefined;
          flag?: OpenMode | undefined;
          flush?: boolean | undefined;
        })
      | BufferEncoding
      | null
  ) => Promise<void>;
  unlink: (filepath: string) => Promise<void>;
  // TODO: Return Dirent[]
  readdir: (dirpath: string) => Promise<string[]>;
  mkdir: () => Promise<void>;
  rmdir: (dirpath: string) => Promise<void>;
  stat: (filepath: string) => Promise<Stats>;
  lstat: (filepath: string) => Promise<Stats>;
  readLink: (filepath: string) => Promise<string>;
  symLink: (target: string, path: string) => Promise<void>;
  chmod: (filepath: string, mode: Mode) => Promise<void>;
};
