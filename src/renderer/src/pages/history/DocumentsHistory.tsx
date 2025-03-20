import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SelectedFileContext } from '../../../../modules/editor-state';
import { ProseMirrorProvider } from '../../../../modules/rich-text/react/context';
import {
  type Commit,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../../../../modules/version-control';
import {
  getDiff,
  getDocumentHandleHistory,
  UncommitedChange,
} from '../../../../modules/version-control/models/document';
import { VersionControlContext } from '../../../../modules/version-control/react';
import { RichTextEditor, type RichTextEditorDiffProps } from '../../components/editing/RichTextEditor';
import { CommitHistoryIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { ChangeLog } from './ChangeLog';

export const DocumentsHistory = ({
  documentId,
}: {
  documentId: VersionControlId;
}) => {
  const { versionedDocumentHandle } = useContext(SelectedFileContext);
  const { getDocumentHandleAtCommit } = useContext(VersionControlContext);
  const [selectedCommitHash, setSelectedCommitHash] =
    React.useState<Commit['hash']>();
  const [docHandle, setDocHandle] =
    React.useState<VersionedDocumentHandle | null>();
  const [diffProps, setDiffProps] = useState<RichTextEditorDiffProps | null>(null)
  const [commits, setCommits] = React.useState<
    Array<UncommitedChange | Commit>
  >([]);
  const navigate = useNavigate();
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);

  const selectCommit = useCallback(
    async (hash: string) => {
      setSelectedCommitHash(hash);
      
      if (versionedDocumentHandle) {
        const currentCommitIndex = commits.findIndex(
          (commit) => commit.hash === hash
        );

        // If it's the first commit, there is no diff;
        // We just get the corresponding doc handle.
        // The first element of the commits array is the current one.
        if (currentCommitIndex === commits.length - 1) {
          const currentCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[currentCommitIndex].heads,
          });

          setDiffProps(null)
          setDocHandle(currentCommitDocHandle)
        } else {
          // In this case, we get the previous & current commits and their diff
          const previousCommitIndex = currentCommitIndex + 1;

          const currentCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[currentCommitIndex].heads,
          });
          const currentCommitDoc = await currentCommitDocHandle.doc();
          const previousCommitDocHandle = await getDocumentHandleAtCommit({
            documentHandle: versionedDocumentHandle,
            heads: commits[previousCommitIndex].heads,
          });
          const previousCommitDoc = await previousCommitDocHandle.doc();
          const diffPatches = await getDiff(
            currentCommitDocHandle,
            commits[previousCommitIndex].hash,
            commits[currentCommitIndex].hash
          );

          if (previousCommitDoc && currentCommitDoc && diffPatches) {
            setDiffProps({
              docBefore: previousCommitDoc,
              docAfter: currentCommitDoc,
              patches: diffPatches
            })
          }
          
          // Due to how the automerge-prosemirror library works, we need to pass a document handle when initializing it.
          // In this case, the doc handle we start the editor with is the previous commit one.
          // The diff plugin will apply a transaction based on the patches and add the diff decorations.
          setDocHandle(previousCommitDocHandle)
        }        
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionedDocument, getDocumentHandleAtCommit]
  );

  useEffect(() => {
    if (versionedDocumentHandle) {
      const commits = getDocumentHandleHistory(versionedDocumentHandle);
      setCommits(commits);
      const [lastChange] = commits;
      if (lastChange) selectCommit(lastChange.hash);
    }
  }, [versionedDocumentHandle, selectCommit]);

  useEffect(() => {
    if (versionedDocumentHandle) {
      const versionedDocument = versionedDocumentHandle.docSync();
      if (versionedDocument) {
        document.title = `v2 | "${versionedDocument.title}" version history`;
        setVersionedDocument(versionedDocument);
      }
    }
  }, [versionedDocumentHandle]);

  const handleCommitClick = (hash: string) => {
    selectCommit(hash);
  };

  return (
    <div className="flex flex-auto items-stretch">
      <div className="w-2/5 grow-0 break-words border-r border-gray-300 p-5 dark:border-neutral-600">
        <SidebarHeading icon={CommitHistoryIcon} text="Version History" />
        <ChangeLog
          changes={commits}
          onClick={handleCommitClick}
          selectedCommit={selectedCommitHash}
        />
      </div>
      <div className="flex w-full grow items-stretch">
        {docHandle ? (
          <div onDoubleClick={() => navigate(`/edit/${documentId}`)}>
            <ProseMirrorProvider>
              <RichTextEditor
                // explicitly define onSave as a no-op
                onSave={() => {}}
                docHandle={docHandle}
                isEditable={false}
                diffProps={diffProps}
              />
            </ProseMirrorProvider>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
};
