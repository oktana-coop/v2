import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { SelectedFileProvider } from '../../../../modules/editor-state';
import { SidebarLayoutProvider } from '../../../../modules/editor-state/sidebar-layout/context';
import { isValidVersionControlId } from '../../../../modules/version-control';
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
    <SelectedFileProvider>
      <Layout>
        <SidebarLayoutProvider>
          {documentId ? (
            isValidAutomergeId ? (
              <DocumentsHistory />
            ) : (
              <InvalidDocument />
            )
          ) : (
            <EmptyDocument message="👈 You can explore a document's editing history by picking up one of the list 😉." />
          )}
        </SidebarLayoutProvider>
      </Layout>
    </SelectedFileProvider>
  );
};
