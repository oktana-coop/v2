import { type AutomergeBinding } from '../../../collaboration/adapters/automerge-document-sharing';
import {
  type ParticipantSelection,
  type PrimaryRichTextDocument,
} from '../../models';
import {
  type DocumentContent,
  initialDocumentContent,
  parseDocumentContent,
} from './document-content';
import { createSharedConvergentDocument } from './shared';

export const richTextAutomergeBinding: AutomergeBinding<
  PrimaryRichTextDocument,
  ParticipantSelection,
  DocumentContent
> = {
  initialContent: (doc) => initialDocumentContent(doc.content),
  parse: parseDocumentContent,
  open: (handle) => createSharedConvergentDocument({ handle }),
};
