import { useContext } from 'react';

import { AuthContext } from '../../../../../../modules/auth/browser';
import { Button } from '../../../../components/actions/Button';
import { GithubIcon } from '../../../../components/icons';
import { GithubVerificationInfoDialog } from './VerificationInfoDialog';

export const GITHUB_COLOR = '#24292f';

export const GithubSyncProvider = () => {
  const {
    githubDeviceFlowVerificationInfo,
    githubUserInfo,
    connectToGithub,
    disconnectFromGithub,
  } = useContext(AuthContext);

  return (
    <>
      <div className="flex items-center gap-2">
        <GithubIcon
          className={`flex-initial text-[${GITHUB_COLOR}] dark:text-white`}
        />
        <div className="flex-auto">
          <p className="mb-1 font-semibold">GitHub</p>
          <p>
            {githubUserInfo
              ? `Connected as ${githubUserInfo.username}`
              : 'Connect to GitHub'}
          </p>
        </div>
        {githubUserInfo ? (
          <Button variant="plain" onClick={disconnectFromGithub}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={connectToGithub}>Connect</Button>
        )}
      </div>
      <GithubVerificationInfoDialog
        isOpen={!githubUserInfo && Boolean(githubDeviceFlowVerificationInfo)}
      />
    </>
  );
};
