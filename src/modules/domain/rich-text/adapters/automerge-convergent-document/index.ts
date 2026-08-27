// Starting a document nobody else can reach.
export { createPrivateConvergentDocument } from './private';
// For whoever already holds a document: the sync service, having found one
// behind a link.
export { createConvergentDocument } from './convergent-document';
// The shape every document this app writes takes, and what it takes to
// recognize one written elsewhere.
export {
  DOCUMENT_FORMAT_VERSION,
  type DocumentContent,
  documentContentSchema,
  initialDocumentContent,
  validateDocumentContent,
} from './document-content';
