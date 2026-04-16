import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { richTextRepresentations } from '../../../../../../modules/domain/rich-text';
import { ExportTemplatesContext } from '../../../../../../modules/personalization/export-templates/context';
import {
  CurrentDocumentContext,
  SidebarLayoutContext,
} from '../../../../app-state';
import { useExport } from '../../../../hooks/use-export';
import { PagedPreview } from '../../../shared/paged-preview/PagedPreview';
import { PrintPreviewActionsBar } from './PrintPreviewActionsBar';

export const PrintPreview = () => {
  const { versionedDocumentId, getExportText } = useContext(
    CurrentDocumentContext
  );
  const { activeTemplate } = useContext(ExportTemplatesContext);
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarLayoutContext);
  const { exportToPDF } = useExport();
  const navigate = useNavigate();

  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!versionedDocumentId) {
      setHtml(null);
      return;
    }

    const fetchHtml = async () => {
      const content = await getExportText(richTextRepresentations.HTML);
      setHtml(content);
    };

    fetchHtml();
  }, [versionedDocumentId, getExportText]);

  useEffect(() => {
    document.title = 'v2 | Print Preview';
  }, []);

  if (!versionedDocumentId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-400">
        <p className="text-sm">No document selected</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-auto flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <PrintPreviewActionsBar
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
        onExportSettings={() => navigate('/settings/exports')}
        onExportToPDF={exportToPDF}
      />
      <PagedPreview html={html} template={activeTemplate} />
    </div>
  );
};
