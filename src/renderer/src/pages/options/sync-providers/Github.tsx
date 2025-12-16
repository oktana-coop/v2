import { Button } from '../../../components/actions/Button';
import { GithubIcon } from '../../../components/icons';

export const GITHUB_COLOR = '#24292f';

export const GithubSyncProvider = () => {
  return (
    <div className="flex items-center gap-2">
      <GithubIcon
        className={`flex-initial text-[${GITHUB_COLOR}] dark:text-white`}
      />
      <div className="flex-auto">
        <p className="mb-1 font-semibold">GitHub</p>
        <p>Connect to GitHub</p>
      </div>
      <Button>Connect</Button>
    </div>
  );
};
