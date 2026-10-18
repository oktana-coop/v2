import { IconButton } from '../../../../components/actions/IconButton';
import { OptionsIcon, PdfIcon } from '../../../../components/icons';
import { SidebarToggleButton } from '../../../shared/sidebar-toggle-button';

export const PrintPreviewActionsBar = ({
  onExportSettings,
  onExportToPDF,
}: {
  onExportSettings: () => void;
  onExportToPDF: () => void;
}) => (
  <div className="flex flex-initial items-center justify-between px-4 py-2">
    <SidebarToggleButton />
    <div className="flex items-center gap-2">
      <IconButton
        icon={<OptionsIcon />}
        onClick={onExportSettings}
        tooltip="Export Settings"
      />
      <IconButton
        icon={<PdfIcon />}
        onClick={onExportToPDF}
        tooltip="Export to PDF"
      />
    </div>
  </div>
);
