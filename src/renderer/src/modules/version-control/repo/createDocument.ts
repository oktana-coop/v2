import { AutomergeUrl, Repo } from '@automerge/automerge-repo';

import { VersionedDocument } from '../document';

export const createDocument =
  (repo: Repo) =>
  async (title: string): Promise<AutomergeUrl> => {
    const handle = repo.create<VersionedDocument>();
    const newDocUrl = handle.url;

    handle.change((doc) => {
      doc.title = title;
      doc.content = title;
    });

    return newDocUrl;
  };
