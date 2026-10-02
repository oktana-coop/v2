import {
  getArtifactName,
  type ProjectRelPath,
} from '../../../../../../modules/domain/project';
import { UnsupportedDocument } from '../../../../components/document-views/UnsupportedDocument';
import { DefaultActionsBar } from '../../../shared/default-actions-bar';

export const UnsupportedDocumentView = ({ path }: { path: ProjectRelPath }) => {
  return (
    <div className="relative flex flex-auto flex-col items-center overflow-hidden">
      <div className="w-full">
        <DefaultActionsBar />
      </div>
      <UnsupportedDocument fileName={getArtifactName(path)} />
    </div>
  );
};
