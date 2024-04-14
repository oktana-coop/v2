import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { default as Automerge } from '@automerge/automerge/next';
import React, { useEffect } from 'react';
import { CommitDialog } from './CommitDialog';
import { FileExplorer } from './FileExplorer';
import { useSearchParams } from 'react-router-dom';

interface Document {
  doc: Automerge.Doc<string>;
}

export function Editor({ docUrl }: { docUrl: AutomergeUrl }) {
  const [value, changeValue] = React.useState<string>('');
  const [isCommitting, openCommitDialog] = React.useState<boolean>(false);
  const [document, changeDocument] = useDocument<Document>(docUrl);
  const [, setSearchParams] = useSearchParams();

  // HACK: This is a temporary solution to get an existing document from the URL
  useEffect(() => {
    setSearchParams({ docUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (document) {
      changeValue(document.doc || '');
    }
  }, [document]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    changeValue(e.target.value);
  };

  const handleBlur = () => {
    changeDocument((doc) => {
      doc.doc = value;
    });
  };

  const commitChanges = (message: string) => {
    changeDocument(
      (doc) => {
        doc.doc = value;
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
            className="focus:shadow-inner h-full w-full resize-none p-5 rounded-sm border-none outline-none border-gray-400"
            autoFocus
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </>
  );
}
