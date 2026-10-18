import { artifactKinds } from '../../../../../../../../modules/domain/project';
import { useCurrentArtifact } from '../../../artifact-route';
import { PlainTextDocumentEditor } from './PlainTextDocumentEditor';
import { RichTextDocumentEditor } from './RichTextDocumentEditor';

export const DocumentEditor = () => {
  const { kind } = useCurrentArtifact();

  return kind === artifactKinds.RICH_TEXT_DOCUMENT ? (
    <RichTextDocumentEditor />
  ) : (
    <PlainTextDocumentEditor />
  );
};
