import { type ChangedDocument } from '../../../../../../../modules/infrastructure/version-control';
import { IconButton } from '../../../../../components/actions/IconButton';
import { CheckIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { ChangedDocumentRow } from './ChangedDocumentRow';

export const UncommittedChangesPanel = ({
  changes,
  selectedDocumentPath,
  onSelectDocument,
  onOpenCommitDialog,
}: {
  changes: ChangedDocument[];
  selectedDocumentPath: string | null;
  onSelectDocument: (path: string) => void;
  onOpenCommitDialog: () => void;
}) => {
  return (
    <div className="flex h-full flex-col overflow-hidden py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading text="Uncommitted Changes" />
        </div>
        {changes.length > 0 && (
          <div className="flex gap-1">
            <IconButton
              onClick={onOpenCommitDialog}
              icon={<CheckIcon size={20} />}
              tooltip="Commit changes"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {changes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p>No uncommitted changes</p>
          </div>
        ) : (
          <ul className="list-none">
            {changes.map((file) => (
              <ChangedDocumentRow
                key={file.path}
                file={file}
                isSelected={selectedDocumentPath === file.path}
                onClick={() => onSelectDocument(file.path)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
