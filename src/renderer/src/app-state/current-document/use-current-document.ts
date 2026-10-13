import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import { CurrentDocumentContext } from './context';
import { type CurrentRichTextDocument } from './types';

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
