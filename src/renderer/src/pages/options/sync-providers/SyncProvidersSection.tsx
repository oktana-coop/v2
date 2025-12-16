import { SyncIcon } from '../../../components/icons';
import { SectionHeader } from '../SectionHeader';
import { GithubSyncProvider } from './Github';

export const SyncProvidersSection = () => {
  return (
    <div className="text-left">
      <SectionHeader icon={SyncIcon} heading="Sync Providers" />
      <p className="mb-6">
        These service providers help you sync your projects across devices and
        collaborate
      </p>
      <GithubSyncProvider />
    </div>
  );
};
