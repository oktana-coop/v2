import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../../../../../app-state';
import { Button } from '../../../../../../../components/actions/Button';
import { FolderIcon } from '../../../../../../../components/icons';

export const NoActiveDirectoryView = () => {
  const { directory, openDirectory, requestPermissionForSelectedDirectory } =
    useContext(MultiDocumentProjectContext);

  const handleOpenDirectory = async () => {
    await openDirectory();
  };

  const handlePermissionRequest = async () => {
    await requestPermissionForSelectedDirectory();
  };

  return (
    <div className="flex h-full items-center justify-center">
      <Button
        onClick={async () =>
          directory?.permissionState === 'prompt'
            ? await handlePermissionRequest()
            : await handleOpenDirectory()
        }
        variant="solid"
        color="purple"
      >
        <FolderIcon className="mr-1" />
        Open Folder
      </Button>
    </div>
  );
};
