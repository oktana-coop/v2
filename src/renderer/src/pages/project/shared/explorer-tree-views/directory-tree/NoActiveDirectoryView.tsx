import { useContext } from 'react';

import {
  CloneFromGithubModalContext,
  MultiDocumentProjectContext,
} from '../../../../../app-state';
import { Button } from '../../../../../components/actions/Button';
import { FolderIcon, GithubIcon } from '../../../../../components/icons';

export const NoActiveDirectoryView = () => {
  const { directory, openDirectory, requestPermissionForSelectedDirectory } =
    useContext(MultiDocumentProjectContext);
  const { openCloneFromGithubModal } = useContext(CloneFromGithubModalContext);

  const handleOpenDirectory = async () => {
    await openDirectory();
  };

  const handlePermissionRequest = async () => {
    await requestPermissionForSelectedDirectory();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Button
        onClick={async () =>
          directory?.permissionState === 'prompt'
            ? await handlePermissionRequest()
            : await handleOpenDirectory()
        }
        variant="solid"
        color="purple"
        className="w-64"
      >
        <FolderIcon className="mr-1" />
        Open Folder
      </Button>
      <Button
        onClick={openCloneFromGithubModal}
        variant="solid"
        color="dark/zinc"
        className="w-64"
      >
        <GithubIcon className="mr-1" />
        Clone from GitHub
      </Button>
    </div>
  );
};
