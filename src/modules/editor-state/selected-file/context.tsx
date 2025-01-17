import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ElectronContext } from '../../electron';
import { FilesystemContext } from '../../filesystem';
import {
  createAutomergePandocAdapter,
  richTextRepresentations,
} from '../../rich-text';
import {
  type DocHandleChangePayload,
  getSpans,
  isValidVersionControlId,
  type RichTextDocument,
  type VersionControlId,
  type VersionedDocumentHandle,
} from '../../version-control';
import { VersionControlContext } from '../../version-control/react';
import { WasmContext } from '../../wasm';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type SelectedFileContextType = {
  selectedFileInfo: SelectedFileInfo | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFileInfo: null,
  setSelectedFileInfo: async () => {},
  clearFileSelection: async () => {},
  versionedDocumentHandle: null,
});

export const SelectedFileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const { findDocument } = useContext(VersionControlContext);
  const { writeFile } = useContext(FilesystemContext);
  const { runWasiCLI } = useContext(WasmContext);

  useEffect(() => {
    const updateFileSelection = async () => {
      if (!isValidVersionControlId(documentId)) {
        clearFileSelection();
        setVersionedDocumentHandle(null);
      } else {
        const pathParam = searchParams.get('path');
        const path = pathParam ? decodeURIComponent(pathParam) : null;

        const documentHandle = await findDocument(documentId);
        if (!documentHandle) {
          throw new Error(
            'No document handle found in repository for the selected document'
          );
        }

        const propagateChangesToFile = async (
          changePayload: DocHandleChangePayload<RichTextDocument>
        ) => {
          console.log('propagating changes to file');
          if (path) {
            const spans = getSpans(changePayload.doc);
            const { transformFromAutomerge } = createAutomergePandocAdapter({
              runWasiCLI,
            });
            const pandocAST = await transformFromAutomerge({
              // Replace non-breaking spaces with regular ones becuase they are causing an issue
              // with the pandoc transformation
              // TODO: Revisit this, understand if this is the proper solution.
              spans: JSON.stringify(spans).replace(/\u00A0/g, ' '),
              representation: richTextRepresentations.PANDOC,
            });
            console.log('pandoc AST', pandocAST);
            writeFile(path, pandocAST);
          }
        };

        documentHandle.on('change', propagateChangesToFile);

        setVersionedDocumentHandle(documentHandle);
        setSelectedFileInfo({
          documentId,
          path,
        });

        return () => {
          documentHandle.off('change', propagateChangesToFile);
        };
      }
    };

    updateFileSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const clearFileSelection = async () => {
    setSelectedFileInfo(null);
  };

  const handleSetSelectedFileInfo = async ({
    documentId,
    path,
  }: SelectedFileInfo) => {
    if (isElectron) {
      window.electronAPI.sendCurrentDocumentId(documentId);
    }

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        versionedDocumentHandle,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
