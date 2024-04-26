import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from '../../components/actions/Link';
import { FolderIcon } from '../../components/icons';
import { PersonalFile } from '../../components/illustrations/PersonalFile';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { DocumentsHistory } from './Document/DocumentsHistory';
import { InvalidDocument } from './InvalidDocument/InvalidDocument';

const DocumentList = () => {
  const [docs, setDocs] = useState<
    Array<{
      id: AutomergeUrl;
      title: string;
    }>
  >([]);

  useEffect(() => {
    const docUrls = localStorage.getItem('docUrls');
    if (docUrls) {
      const docs = JSON.parse(docUrls);
      const docsWithTitles = Object.entries(docs).map(([key, value]) => ({
        id: key as AutomergeUrl,
        title: value as string,
      }));
      setDocs(docsWithTitles);
    }
  }, []);

  return (
    <>
      <SidebarHeading icon={FolderIcon} text="File Explorer" />
      {docs.map((doc) => (
        <div className="text-left" key={doc.id}>
          <Link to={`/history/${doc.id}`}>{doc.title}</Link>
        </div>
      ))}
    </>
  );
};

export const History = () => {
  const { documentId } = useParams();
  const [isValidAutomergeId, setIsValidAutomergeId] =
    React.useState<boolean>(false);

  useEffect(() => {
    document.title = 'v2 | Version History';
  }, []);

  useEffect(() => {
    const urlValidity = isValidAutomergeUrl(documentId);
    setIsValidAutomergeId(urlValidity);
  }, [documentId]);

  return documentId ? (
    isValidAutomergeId ? (
      <DocumentsHistory documentId={documentId as AutomergeUrl} />
    ) : (
      <InvalidDocument />
    )
  ) : (
    <div className="flex-auto flex">
      <div className="h-full w-2/5 grow-0 p-5 overflow-y-auto border-r border-gray-300 dark:border-neutral-600">
        <DocumentList />
      </div>
      <div className="h-full w-full grow flex flex-col items-center justify-center">
        <h2 className="text-2xl">Welcome to v2 👋</h2>
        <p>
          👈 You can explore a document's editing history by picking up one of
          the list 😉.
        </p>
        <PersonalFile />
      </div>
    </div>
  );
};
