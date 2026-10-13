import { type AutomergeBinding } from '../../../collaboration/adapters/automerge-document-sharing';
import {
  type PlainTextDocument,
  type PlainTextParticipantSelection,
} from '../../models';
import {
  type DocumentContent,
  initialDocumentContent,
  parseDocumentContent,
} from './document-content';
import { createSharedConvergentDocument } from './shared';

export const plainTextAutomergeBinding: AutomergeBinding<
  PlainTextDocument,
  PlainTextParticipantSelection,
  DocumentContent
> = {
  initialContent: (doc) => initialDocumentContent(doc.content),
  parse: parseDocumentContent,
  open: (handle) => createSharedConvergentDocument({ handle }),
};
