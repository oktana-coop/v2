import { MouseEventHandler, useCallback, useContext } from 'react';

import { AuthContext } from '../../../../../../modules/auth/browser';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/electron-context';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { GithubIcon } from '../../../../components/icons';

type GithubVerificationInfoDialogProps = {
  isOpen?: boolean;
  onCancel?: () => void;
};

export const GithubVerificationInfoDialog = ({
  isOpen,
  onCancel,
}: GithubVerificationInfoDialogProps) => {
  const { openExternalLink } = useContext(ElectronContext);
  const { githubDeviceFlowVerificationInfo } = useContext(AuthContext);

  const handleOpenGithub: MouseEventHandler<HTMLAnchorElement> = useCallback(
    (ev) => {
      if (githubDeviceFlowVerificationInfo) {
        ev.preventDefault();
        openExternalLink(githubDeviceFlowVerificationInfo.verificationUri);
      }
    },
    [openExternalLink, githubDeviceFlowVerificationInfo]
  );

  if (!githubDeviceFlowVerificationInfo) {
    return null;
  }

  return (
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
          onClick={handleOpenGithub}
          to={githubDeviceFlowVerificationInfo.verificationUri}
        >
          <GithubIcon />
          Open GitHub
        </Button>
      }
    >
      <p>Waiting for authorization...</p>
      <ol>
        <li>
          Visit <a href={githubDeviceFlowVerificationInfo.verificationUri} />
        </li>
        <li>
          Enter Code: <pre>{githubDeviceFlowVerificationInfo.userCode}</pre>
        </li>
      </ol>
    </Modal>
  );
};
