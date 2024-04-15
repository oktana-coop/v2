import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';

import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { InvalidDocument } from '../pages/History/InvalidDocument';
import { DocumentEditor } from './DocumentEditor';

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
        <DocumentEditor docUrl={documentId as AutomergeUrl} />
      ) : (
        <InvalidDocument />
      )}
    </>
  );
};
