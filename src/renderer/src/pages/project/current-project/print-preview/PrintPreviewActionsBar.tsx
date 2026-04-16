import { useRef } from 'react';

import { IconButton } from '../../../../components/actions/IconButton';
import {
  OptionsIcon,
  PdfIcon,
  SidebarIcon,
  SidebarOpenIcon,
} from '../../../../components/icons';

export const PrintPreviewActionsBar = ({
  isSidebarOpen,
  onSidebarToggle,
  onExportSettings,
  onExportToPDF,
}: {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onExportSettings: () => void;
  onExportToPDF: () => void;
}) => {
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSidebarToggle = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onSidebarToggle();

    if (sidebarButtonRef.current) {
      sidebarButtonRef.current.removeAttribute('data-headlessui-state');
      sidebarButtonRef.current.removeAttribute('data-hover');
    }
  };

  return (
    <div className="flex flex-initial items-center justify-between px-4 py-2">
      <IconButton
        ref={sidebarButtonRef}
        icon={isSidebarOpen ? <SidebarOpenIcon /> : <SidebarIcon />}
        onClick={handleSidebarToggle}
      />
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
};
