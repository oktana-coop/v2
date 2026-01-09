import { removeExtension } from '../../../../../../../modules/infrastructure/filesystem';
import { type ModifyDeleteConflict as ModifyDeleteConflictType } from '../../../../../../../modules/infrastructure/version-control';
import { FileDocumentIcon } from '../../../../../components/icons';
import { Heading3 } from '../../../../../components/typography/headings/Heading3';

export const ModifyDeleteConflict = ({
  conflict,
}: {
  conflict: ModifyDeleteConflictType;
}) => (
  <div className="mb-4 flex items-center gap-x-2">
    <FileDocumentIcon className="text-black text-opacity-90 dark:text-white dark:text-opacity-90" />
    <Heading3 className="!mb-0">{removeExtension(conflict.path)}</Heading3>
  </div>
);
