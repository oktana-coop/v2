import {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

export type IsoGitDeps = {
  isoGitFs: IsoGitFsApi;
  isoGitHttp: IsoGitHttpApi;
  dir: string;
};
