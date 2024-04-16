import { AutomergeUrl, isValidAutomergeUrl } from '@automerge/automerge-repo';
import React, { useEffect } from 'react';

import { useParams } from 'react-router-dom';
import { InvalidDocument } from './InvalidDocument';
import { ViewHistory } from './ViewHistory';

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
        <ViewHistory documentId={documentId as AutomergeUrl} />
      ) : (
        <InvalidDocument />
      )}
    </>
  );
};
