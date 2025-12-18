import { useContext } from 'react';

import {
  AuthContext,
  GITHUB_COLOR,
} from '../../../../../../../modules/auth/browser';
import { Button } from '../../../../../components/actions/Button';
import { GithubIcon } from '../../../../../components/icons';
import { GithubVerificationInfoDialog } from '../../../../shared/sync-providers/github/VerificationInfoDialog';
import { SelectRepository } from './SelectRepository';

export const GithubProjectSettings = () => {
  const {
    githubDeviceFlowVerificationInfo,
    githubUserInfo,
    connectToGithub,
    cancelConnectingToGithub,
  } = useContext(AuthContext);

  return (
    <>
      <div className="flex items-center gap-2">
        <GithubIcon
          className={`flex-initial text-[${GITHUB_COLOR}] dark:text-white`}
        />
        {githubUserInfo ? (
          <>
            <div className="flex-auto">
              <p>Connect a GitHub repository</p>
            </div>
            <SelectRepository />
          </>
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
      <GithubVerificationInfoDialog
        isOpen={!githubUserInfo && Boolean(githubDeviceFlowVerificationInfo)}
        onCancel={cancelConnectingToGithub}
      />
    </>
  );
};
