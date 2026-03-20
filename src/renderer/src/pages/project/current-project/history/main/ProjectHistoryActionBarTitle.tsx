import {
  removeExtension,
  removePath,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  type ChangedDocument,
  documentChangeTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { ChangeTypePill } from '../../../../../components/versioning';

export const ProjectHistoryActionBarTitle = ({
  document,
  commitMessage,
}: {
  document: ChangedDocument;
  commitMessage: string | null;
}) => {
  const previousName =
    document.changeType === documentChangeTypes.RENAMED
      ? removeExtension(removePath(document.previousPath))
      : null;

  return (
    <span className="ml-3 inline-flex items-center gap-2.5 text-xs text-zinc-500 dark:text-neutral-400">
      <span className="h-4 w-px shrink-0 bg-zinc-300 dark:bg-neutral-600" />
      <ChangeTypePill changeType={document.changeType} />
      {previousName && <span>from &ldquo;{previousName}&rdquo;</span>}
      {commitMessage && !previousName && (
        <span className="max-w-xs truncate">in {commitMessage}</span>
      )}
    </span>
  );
};
