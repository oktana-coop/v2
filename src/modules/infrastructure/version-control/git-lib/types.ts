import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

export type IsoGitDeps = {
  isoGitFs: IsoGitFsApi;
  dir: string;
};
