import { useContext, useState } from 'react';

import {
  AuthContext,
  GITHUB_COLOR,
} from '../../../../../../../modules/auth/browser';
import { type GithubRepositoryInfo } from '../../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../../components/actions/Button';
import { GithubIcon } from '../../../../../components/icons';
import { GithubVerificationInfoDialog } from '../../../../shared/sync-providers/github/VerificationInfoDialog';
import { SelectRepository } from './SelectRepository';

export const GithubProjectSettings = () => {
  const [selectedRepository, setSelectedRepository] =
    useState<GithubRepositoryInfo | null>(null);

  const {
    githubDeviceFlowVerificationInfo,
    githubUserInfo,
    connectToGithub,
    cancelConnectingToGithub,
  } = useContext(AuthContext);

  const handleSelectRepository = (repository: GithubRepositoryInfo) => {
    setSelectedRepository(repository);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <GithubIcon
          className={`flex-initial text-[${GITHUB_COLOR}] dark:text-white`}
        />
        {githubUserInfo ? (
          <>
            <div className="flex-auto">
              <p className="mb-1 font-semibold">Connect a GitHub repository</p>
              <SelectRepository onSelect={handleSelectRepository} />
            </div>
            <Button onClick={() => {}} disabled={!selectedRepository}>
              Connect
            </Button>
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
