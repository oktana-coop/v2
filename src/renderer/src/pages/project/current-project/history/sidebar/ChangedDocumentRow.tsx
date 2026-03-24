import { clsx } from 'clsx';

import {
  getParentPath,
  removePath,
} from '../../../../../../../modules/infrastructure/filesystem';
import { type ChangedDocument } from '../../../../../../../modules/infrastructure/version-control';
import { FileExtensionIcon } from '../../../../../components/navigation';
import { ChangeTypeBadge } from '../../../../../components/versioning';

export const ChangedDocumentRow = ({
  file,
  isSelected,
  onClick,
}: {
  file: ChangedDocument;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const fileName = removePath(file.path);
  const parentPath = getParentPath(file.path);

  return (
    <li>
      <button
        className={clsx(
          'flex h-[32px] w-full cursor-pointer items-center overflow-hidden text-ellipsis text-nowrap py-0.5 pr-2 text-left text-sm hover:bg-zinc-950/5 dark:hover:bg-white/5',
          isSelected ? 'bg-purple-50 dark:bg-neutral-600' : ''
        )}
        style={{ paddingLeft: 40 }}
        onClick={onClick}
      >
        <FileExtensionIcon fileName={fileName} />
        <span className="min-w-0 flex-1 truncate">
          {fileName}
          {parentPath && (
            <span className="ml-1 text-xs text-zinc-400 dark:text-neutral-500">
              {parentPath}
            </span>
          )}
        </span>
        <ChangeTypeBadge changeType={file.changeType} />
      </button>
    </li>
  );
};
