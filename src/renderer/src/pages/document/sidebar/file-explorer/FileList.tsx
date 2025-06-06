import { clsx } from 'clsx';

import { type SelectedFileInfo } from '../../../../../../modules/app-state';
import {
  type File,
  removeExtension,
} from '../../../../../../modules/infrastructure/filesystem';
import { FileDocumentIcon } from '../../../../components/icons';

export const FileList = ({
  files,
  selectedFileInfo,
  onFileSelection,
}: {
  files: Array<File>;
  selectedFileInfo: SelectedFileInfo | null;
  onFileSelection: (file: File) => Promise<void>;
}) => {
  return (
    <ul className="flex flex-col items-stretch text-black dark:text-white">
      {files.map((file) => (
        <li
          key={file.name}
          className={clsx(
            'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
            file.path === selectedFileInfo?.path
              ? 'bg-purple-50 dark:bg-neutral-600'
              : ''
          )}
        >
          <button
            className="flex w-full items-center truncate bg-transparent text-left"
            title={file.name}
            onClick={async () => onFileSelection(file)}
          >
            <FileDocumentIcon className="mr-1" size={16} />
            {removeExtension(file.name)}
          </button>
        </li>
      ))}
    </ul>
  );
};
