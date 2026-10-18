import { type AutomergeBinding } from '../../../collaboration/adapters/automerge-document-sharing';
import {
  type ParticipantSelection,
  type PlainTextDocument,
} from '../../models';
import {
  type DocumentContent,
  initialDocumentContent,
  parseDocumentContent,
} from './document-content';
import { createSharedConvergentDocument } from './shared';

export const plainTextAutomergeBinding: AutomergeBinding<
  PlainTextDocument,
  ParticipantSelection,
  DocumentContent
> = {
  initialContent: (doc) => initialDocumentContent(doc.content),
  parse: parseDocumentContent,
  open: (handle) => createSharedConvergentDocument({ handle }),
};
