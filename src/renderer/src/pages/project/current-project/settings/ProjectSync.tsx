import { SyncIcon } from '../../../../components/icons';
import { SectionHeader } from '../../../shared/settings/SectionHeader';
import { GithubProjectSettings } from './github';

export const ProjectSync = () => (
  <div className="text-left">
    <SectionHeader icon={SyncIcon} heading="Project Sync" />
    <p className="mb-6">
      The corresponding project in a remote computer (e.g. in the cloud) which
      can serve as backup and/or collaboration node.
    </p>
    <GithubProjectSettings />
  </div>
);
