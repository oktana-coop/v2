import { MouseEventHandler, useCallback, useContext, useState } from 'react';

import { AuthContext } from '../../../../../../modules/auth/browser';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/browser';
import { Button } from '../../../../components/actions/Button';
import { Modal } from '../../../../components/dialogs/Modal';
import { CheckIcon, GithubIcon } from '../../../../components/icons';
import { CopyIcon } from '../../../../components/icons';

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
  const [copied, setCopied] = useState(false);

  const handleOpenGithub: MouseEventHandler<HTMLAnchorElement> = useCallback(
    (ev) => {
      if (githubDeviceFlowVerificationInfo) {
        ev.preventDefault();
        openExternalLink(githubDeviceFlowVerificationInfo.verificationUri);
      }
    },
    [openExternalLink, githubDeviceFlowVerificationInfo]
  );

  const handleCopyCode: MouseEventHandler<HTMLButtonElement> =
    useCallback(async () => {
      if (githubDeviceFlowVerificationInfo) {
        await navigator.clipboard.writeText(
          githubDeviceFlowVerificationInfo.userCode
        );

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, [githubDeviceFlowVerificationInfo]);

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
      <div className="mb-4 space-y-2 border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
          Follow these steps:
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-purple-800 dark:text-purple-200">
          <li>Copy the code below</li>
          <li>Click "Open GitHub" to visit the authorization page</li>
          <li>Paste the code and approve access</li>
        </ol>
      </div>
      <Button className="w-full" variant="outline" onClick={handleCopyCode}>
        {copied ? (
          <CheckIcon className="mr-1 text-green-500 dark:text-green-300" />
        ) : (
          <CopyIcon className="mr-1" />
        )}
        {githubDeviceFlowVerificationInfo.userCode}
      </Button>
    </Modal>
  );
};
