import { removeExtension } from '../../../../../../../modules/infrastructure/filesystem';
import {
  type MergeConflictInfo,
  mergePoles,
  type ModifyDeleteConflict as ModifyDeleteConflictType,
} from '../../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../../components/actions/Button';
import { FileDocumentIcon } from '../../../../../components/icons';
import { Heading3 } from '../../../../../components/typography/headings/Heading3';
import { useMergeConflictResolution } from '../../../../../hooks';
import { MergePole } from '../merge-info/MergePole';

export const ModifyDeleteConflict = ({
  conflict,
  mergeConflictInfo,
}: {
  conflict: ModifyDeleteConflictType;
  mergeConflictInfo: MergeConflictInfo;
}) => {
  const {
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
  } = useMergeConflictResolution();

  const handleKeepDocument = () => {
    resolveConflictByKeepingDocument(conflict.artifactId);
  };

  const handleDeleteDocument = () => {
    resolveConflictByDeletingDocument(conflict.artifactId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-x-2">
        <FileDocumentIcon className="text-black text-opacity-90 dark:text-white dark:text-opacity-90" />
        <Heading3 className="!mb-0">{removeExtension(conflict.path)}</Heading3>
      </div>
      <ul className="flex list-disc flex-col gap-3 pl-5">
        <li>
          {conflict.deletedIn === mergePoles.MERGE_SOURCE
            ? 'Deleted in '
            : 'Edited in '}
          <MergePole
            branch={mergeConflictInfo.sourceBranch}
            commitId={mergeConflictInfo.sourceCommitId}
          />
        </li>
        <li>
          {conflict.deletedIn === mergePoles.MERGE_TARGET
            ? 'Deleted in '
            : 'Edited in '}
          <MergePole
            branch={mergeConflictInfo.targetBranch}
            commitId={mergeConflictInfo.targetCommitId}
          />
        </li>
      </ul>
      <div className="flex gap-3">
        <Button
          variant="outline"
          color="purple"
          size="sm"
          onClick={handleKeepDocument}
        >
          Keep File
        </Button>
        <Button
          variant="outline"
          color="purple"
          size="sm"
          onClick={handleDeleteDocument}
        >
          Delete File
        </Button>
      </div>
    </div>
  );
};
