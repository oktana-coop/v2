// Starting a document nobody else can reach.
export { createPrivateConvergentDocument } from './private';
// For whoever already holds a document: the sync service, having found one
// behind a link.
export { createConvergentDocument } from './convergent-document';
// The shape every document starts in, and what it takes to read one.
export {
  initialSharedContent,
  SHARE_FORMAT_VERSION,
  type SharedContent,
  validateSharedContent,
} from './shared-content';
