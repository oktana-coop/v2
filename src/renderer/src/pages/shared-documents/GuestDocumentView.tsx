import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import { GuestEditingContext } from '../../app-state';
import { GuestPlainTextDocumentEditor } from './GuestPlainTextDocumentEditor';
import { GuestRichTextDocumentEditor } from './GuestRichTextDocumentEditor';

// Shows the share's document in its kind's editor. Until it opens, the
// rich-text editor shows its skeleton.
export const GuestDocumentView = () => {
  const { guestDocument } = useContext(GuestEditingContext);

  return guestDocument?.kind === artifactKinds.PLAIN_TEXT_DOCUMENT ? (
    <GuestPlainTextDocumentEditor />
  ) : (
    <GuestRichTextDocumentEditor />
  );
};
