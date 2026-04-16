import { type ExportTemplate } from '../../../../../modules/personalization';
import { PagedPreview } from '../../shared/paged-preview/PagedPreview';
import { sampleContent } from './sample-content';

type TemplatePreviewProps = {
  template: ExportTemplate;
};

export const TemplatePreview = ({ template }: TemplatePreviewProps) => (
  <PagedPreview
    html={sampleContent}
    template={template}
    loadingClassName="bg-white/50 dark:bg-zinc-900/50"
  />
);
