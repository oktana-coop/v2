import { useContext, useEffect, useState } from 'react';

import {
  AuthContext,
  GITHUB_COLOR,
} from '../../../../../../../modules/auth/browser';
import { type GithubRepositoryInfo } from '../../../../../../../modules/infrastructure/version-control';
import { Button } from '../../../../../components/actions/Button';
import { GithubIcon } from '../../../../../components/icons';
import { useRemoteProjectInfo } from '../../../../../hooks';
import { GithubVerificationInfoDialog } from '../../../../shared/sync-providers/github/VerificationInfoDialog';
import { SelectRepository } from './SelectRepository';

const getFullNameFromUrl = (url: string) => {
  const match = url.match(/github\.com[:/](.+\/.+?)(?:\.git)?$/);
  return match ? match[1] : null;
};

export const GithubProjectSettings = () => {
  const [selectedRepository, setSelectedRepository] =
    useState<GithubRepositoryInfo | null>(null);

  const {
    githubDeviceFlowVerificationInfo,
    githubUserInfo,
    connectToGithub,
    cancelConnectingToGithub,
  } = useContext(AuthContext);

  const { remoteProject, addRemoteProject } = useRemoteProjectInfo();

  const handleSelectRepository = (repository: GithubRepositoryInfo) => {
    setSelectedRepository(repository);
  };

  const handleConnectSelectedRepository = () => {
    if (selectedRepository) {
      addRemoteProject(selectedRepository.cloneUrl);
      setSelectedRepository(null);
    }
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
              <p className="mb-1 font-semibold">
                {remoteProject
                  ? 'GitHub Repository'
                  : 'Connect a GitHub repository'}
              </p>
              {remoteProject ? (
                <span>
                  Connected to{' '}
                  <strong>
                    {getFullNameFromUrl(remoteProject.url) ?? remoteProject.url}
                  </strong>
                </span>
              ) : (
                <SelectRepository onSelect={handleSelectRepository} />
              )}
            </div>
            {!remoteProject && (
              <Button
                onClick={handleConnectSelectedRepository}
                disabled={!selectedRepository}
              >
                Connect
              </Button>
            )}
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
