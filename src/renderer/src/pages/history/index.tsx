import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { InvalidDocument } from '../../components/document-views/InvalidDocument';
import { Layout } from '../../components/layout/Layout';
import {
  AutomergeUrl,
  isValidAutomergeUrl,
} from '../../../../modules/version-control';
import { DocumentsHistory } from './DocumentsHistory';

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
