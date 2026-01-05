import { useContext, useState } from 'react';

import {
  AuthContext,
  GITHUB_COLOR,
} from '../../../../../../modules/auth/browser';
import { projectTypes } from '../../../../../../modules/domain/project';
import { type GithubRepositoryInfo } from '../../../../../../modules/infrastructure/version-control';
import { CloneFromGithubModalContext } from '../../../../app-state';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { GithubIcon } from '../../../../components/icons';
import { useCreateDocument } from '../../../../hooks';
import { useOpenDirectory } from '../../../../hooks/multi-document-project';
import { SelectRepository } from './SelectRepository';
import { GithubVerificationInfoDialog } from './VerificationInfoDialog';

export type CloneFromGithubDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
};

export const CloneFromGithubDialog = ({
  isOpen,
  onCancel,
}: CloneFromGithubDialogProps) => {
  const [selectedRepository, setSelectedRepository] =
    useState<GithubRepositoryInfo | null>(null);

  const {
    githubUserInfo,
    connectToGithub,
    githubDeviceFlowVerificationInfo,
    cancelConnectingToGithub,
  } = useContext(AuthContext);
  const { closeCloneFromGithubModal } = useContext(CloneFromGithubModalContext);

  const { triggerDocumentCreationDialog } = useCreateDocument();
  const openDirectory = useOpenDirectory();

  const handlePrimaryAction = async () => {
    if (selectedRepository) {
      if (window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
        await openDirectory(selectedRepository.cloneUrl);
      } else {
        await triggerDocumentCreationDialog(selectedRepository.cloneUrl);
      }

      closeCloneFromGithubModal();
    }
  };

  const handleSelectRepository = (repository: GithubRepositoryInfo) => {
    setSelectedRepository(repository);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="GitHub Integration"
        secondaryButton={
          <Button variant="plain" onClick={onCancel}>
            Cancel
          </Button>
        }
        primaryButton={
          <Button
            onClick={handlePrimaryAction}
            disabled={!selectedRepository?.cloneUrl}
          >
            {window.config.projectType === projectTypes.MULTI_DOCUMENT_PROJECT
              ? 'Select Local Folder'
              : 'Write to Document'}
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <GithubIcon
            className={`flex-initial text-[${GITHUB_COLOR}] dark:text-white`}
          />
          {githubUserInfo ? (
            <div className="flex-auto">
              <p className="mb-1 font-semibold">Connect a GitHub repository</p>
              <SelectRepository onSelect={handleSelectRepository} />
            </div>
          ) : (
            <>
              <div className="flex-auto">
                <p className="mb-1 font-semibold">GitHub</p>
                <p>Connect to GitHub</p>
              </div>
              <Button onClick={connectToGithub}>Connect</Button>
            </>
          )}
        </div>
      </Modal>
      <GithubVerificationInfoDialog
        isOpen={!githubUserInfo && Boolean(githubDeviceFlowVerificationInfo)}
        onCancel={cancelConnectingToGithub}
      />
    </>
  );
};
