import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import React, { useEffect } from 'react';
import { CommitDialog } from './CommitDialog';
import { VersionedDocument } from '../automerge';
import { writeFile } from '../utils/filesystem';

export const DocumentEditor = ({
  docUrl,
  fileHandle,
}: {
  docUrl: AutomergeUrl;
  fileHandle: FileSystemFileHandle;
}) => {
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
    // On Blur ==> auto-save if needed
    // no-matter if there are any changes if you changeDocument it
    // produces a new hash
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

    const fileContent = {
      docUrl,
      value,
    };
    writeFile(fileHandle, fileContent);

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
      <div className="flex-auto flex items-stretch">
        <div className="w-full grow flex items-stretch">
          <textarea
            id="message"
            value={value}
            rows={4}
            className="bg-inherit focus:shadow-inner w-full resize-none p-5 outline-none"
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
