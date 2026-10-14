import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import {
  GuestEditingContext,
  type GuestPlainTextDocument,
  type GuestRichTextDocument,
} from './context';

// The share's document when it is a rich-text one.
export const useGuestRichTextDocument = (): GuestRichTextDocument | null => {
  const { guestDocument } = useContext(GuestEditingContext);

  return guestDocument?.kind === artifactKinds.RICH_TEXT_DOCUMENT
    ? guestDocument
    : null;
};

// The share's document when it is a plain-text one.
export const useGuestPlainTextDocument = (): GuestPlainTextDocument | null => {
  const { guestDocument } = useContext(GuestEditingContext);

  return guestDocument?.kind === artifactKinds.PLAIN_TEXT_DOCUMENT
    ? guestDocument
    : null;
};
