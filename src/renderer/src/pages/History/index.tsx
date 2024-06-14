import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyDocument } from '../../components/flow-commons/EmptyDocument';
import { InvalidDocument } from '../../components/flow-commons/InvalidDocument';
import { Layout } from '../../components/layout/Layout';
import { SelectedFileProvider } from '../../filesystem';
import { DocumentsHistory } from './Document/DocumentsHistory';

export const History = () => {
  return (
    <SelectedFileProvider>
      <HistoryIndex />
    </SelectedFileProvider>
  );
};

const HistoryIndex = () => {
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

  return (
    <Layout>
      {documentId ? (
        isValidAutomergeId ? (
          <DocumentsHistory documentId={documentId as AutomergeUrl} />
        ) : (
          <InvalidDocument />
        )
      ) : (
        <EmptyDocument message="👈 You can explore a document's editing history by picking up one of the list 😉." />
      )}
    </Layout>
  );
};
