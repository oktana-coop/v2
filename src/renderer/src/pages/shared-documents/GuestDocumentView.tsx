import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import { GuestEditingContext } from '../../app-state';
import { UnsupportedDocument } from '../../components/document-views/UnsupportedDocument';
import { GuestRichTextDocumentEditor } from './GuestRichTextDocumentEditor';

// Shows the share's document in its kind's editor. Until it opens, the
// rich-text editor shows its skeleton.
export const GuestDocumentView = () => {
  const { guestDocument, name } = useContext(GuestEditingContext);

  // TODO: Use the plain-text editor once there is one.
  if (guestDocument?.kind === artifactKinds.PLAIN_TEXT_DOCUMENT) {
    return <UnsupportedDocument fileName={name ?? ''} />;
  }

  return <GuestRichTextDocumentEditor />;
};
