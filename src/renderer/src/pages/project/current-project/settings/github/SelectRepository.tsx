import { useContext, useEffect, useState } from 'react';

import { AuthContext } from '../../../../../../../modules/auth/browser';
import { ElectronContext } from '../../../../../../../modules/infrastructure/cross-platform/browser';
import { GithubRepositoryInfo } from '../../../../../../../modules/infrastructure/version-control';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../../../components/inputs/Listbox';

export const SelectRepository = () => {
  const { isElectron } = useContext(ElectronContext);
  const [githubRepositories, setGithubRepositories] = useState<
    GithubRepositoryInfo[]
  >([]);

  const { githubUserInfo } = useContext(AuthContext);

  useEffect(() => {
    const fetchRepositories = async () => {
      const repos =
        await window.versionControlSyncProvidersAPI.getGithubUserRepositories();
      setGithubRepositories(repos);
    };

    if (githubUserInfo && isElectron) {
      fetchRepositories();
    }
  }, [githubUserInfo, isElectron]);

  return (
    <div className="max-w-64">
      <Listbox
        placeholder="Select GitHub repository&hellip;"
        name="github-repository-select"
      >
        {githubRepositories.map(({ fullName }) => (
          <ListboxOption key={fullName} value={fullName} className="max-w-2xl">
            <ListboxLabel>{fullName}</ListboxLabel>
          </ListboxOption>
        ))}
      </Listbox>
    </div>
  );
};
