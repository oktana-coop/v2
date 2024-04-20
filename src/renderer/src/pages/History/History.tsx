import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';
import React, { useEffect } from 'react';

import { useParams } from 'react-router-dom';
import { DocumentsHistory } from './Document/DocumentsHistory';
import { InvalidDocument } from './InvalidDocument/InvalidDocument';

export const History = () => {
  const { documentId } = useParams();
  const [isValid, setIsValid] = React.useState<boolean>(false);

  useEffect(() => {
    const urlValidity = isValidAutomergeUrl(documentId);
    setIsValid(urlValidity);
  }, [documentId]);

  return (
    <>
      {isValid ? (
        <DocumentsHistory documentId={documentId as AutomergeUrl} />
      ) : (
        <InvalidDocument />
      )}
    </>
  );
};
