import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentEditor } from './DocumentEditor';
import { InvalidDocument } from '../pages/History/InvalidDocument/InvalidDocument';

export const Editor = () => {
  const { documentId } = useParams();
  const [isValid, setIsValid] = React.useState<boolean>(false);

  useEffect(() => {
    const urlValidity = isValidAutomergeUrl(documentId);
    setIsValid(urlValidity);
  }, [documentId]);

  return (
    <>
      {isValid ? (
        <DocumentEditor initDocUrl={documentId as AutomergeUrl} />
      ) : (
        <InvalidDocument />
      )}
    </>
  );
};
