import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import React, { useEffect } from 'react';
import { CommitDialog } from './CommitDialog';
import { FileExplorer } from './FileExplorer';
import { VersionedDocument } from '../automerge';

export const DocumentEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [value, changeValue] = React.useState<string>('');
  const [isCommitting, openCommitDialog] = React.useState<boolean>(false);
  const [versionedDocument, changeDocument] =
    useDocument<VersionedDocument>(docUrl);

  useEffect(() => {
    if (versionedDocument) {
      changeValue(versionedDocument.content || '');
      document.title = `v2 | editing "${versionedDocument.title}"`;
    }
  }, [versionedDocument]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    changeValue(e.target.value);
  };

  const handleBlur = () => {
    // On BLur ==> auto-save if needed
    if (versionedDocument?.content !== value) {
      changeDocument((doc) => {
        doc.content = value;
      });
    }
  };

  const commitChanges = (message: string) => {
    changeDocument(
      (doc) => {
        doc.content = value;
      },
      {
        message,
        time: new Date().getTime(),
      }
    );
    openCommitDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // cmd/ctrl + s
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      openCommitDialog(true);
    }
  };

  return (
    <>
      <CommitDialog
        isOpen={isCommitting}
        onCancel={() => openCommitDialog(false)}
        onCommit={(message: string) => commitChanges(message)}
      />
      <div className="flex-auto flex">
        <div className="h-full w-2/5 grow-0">
          <FileExplorer />
        </div>
        <div className="h-full w-full grow">
          <textarea
            id="message"
            value={value}
            rows={4}
            className="bg-inherit focus:shadow-inner h-full w-full resize-none p-5 outline-none"
            autoFocus
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </>
  );
};
