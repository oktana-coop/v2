import { type documentChangeTypes } from './document-change-types';

type AddedDocument = {
  path: string;
  changeType: typeof documentChangeTypes.ADDED;
};

type ModifiedDocument = {
  path: string;
  changeType: typeof documentChangeTypes.MODIFIED;
};

type DeletedDocument = {
  path: string;
  changeType: typeof documentChangeTypes.DELETED;
};

type RenamedDocument = {
  path: string;
  changeType: typeof documentChangeTypes.RENAMED;
  previousPath: string;
};

export type ChangedDocument =
  | AddedDocument
  | ModifiedDocument
  | DeletedDocument
  | RenamedDocument;
