import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import { CurrentDocumentContext } from './context';
import {
  type CurrentPlainTextDocument,
  type CurrentRichTextDocument,
} from './types';

// The open document, whatever its kind.
export const useCurrentLiveDocument = () =>
  useContext(CurrentDocumentContext).currentDocument?.liveDocument ?? null;

// The open document when it is a rich-text one, null otherwise.
export const useCurrentRichTextDocument =
  (): CurrentRichTextDocument | null => {
    const { currentDocument } = useContext(CurrentDocumentContext);

    return currentDocument?.kind === artifactKinds.RICH_TEXT_DOCUMENT
      ? currentDocument
      : null;
  };

// The open document when it is a plain-text one, null otherwise.
export const useCurrentPlainTextDocument =
  (): CurrentPlainTextDocument | null => {
    const { currentDocument } = useContext(CurrentDocumentContext);

    return currentDocument?.kind === artifactKinds.PLAIN_TEXT_DOCUMENT
      ? currentDocument
      : null;
  };
