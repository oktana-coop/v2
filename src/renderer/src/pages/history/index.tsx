import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import {
  isValidVersionControlId,
  type VersionControlId,
} from '../../../../modules/version-control';
import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { InvalidDocument } from '../../components/document-views/InvalidDocument';
import { Layout } from '../../components/layout/Layout';
import { DocumentsHistory } from './DocumentsHistory';

export const History = () => {
  const { documentId } = useParams();
  const [isValidAutomergeId, setIsValidAutomergeId] =
    React.useState<boolean>(false);

  useEffect(() => {
    document.title = 'v2 | Version History';
  }, []);

  useEffect(() => {
    const urlValidity = isValidVersionControlId(documentId);
    setIsValidAutomergeId(urlValidity);
  }, [documentId]);

  return (
    <Layout>
      {documentId ? (
        isValidAutomergeId ? (
          <DocumentsHistory documentId={documentId as VersionControlId} />
        ) : (
          <InvalidDocument />
        )
      ) : (
        <EmptyDocument message="👈 You can explore a document's editing history by picking up one of the list 😉." />
      )}
    </Layout>
  );
};
