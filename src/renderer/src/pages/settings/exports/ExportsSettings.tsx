import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';

import {
  DEFAULT_TEMPLATE_ID,
  defaultExportTemplate,
  type ExportTemplate,
} from '../../../../../modules/personalization/export-templates';
import { ExportTemplatesContext } from '../../../../../modules/personalization/export-templates/context';
import { Button } from '../../../components/actions/Button';
import { IconButton } from '../../../components/actions/IconButton';
import { ExportIcon, PenIcon, TrashIcon } from '../../../components/icons';
import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../components/inputs/Listbox';
import { Breadcrumb } from '../../../components/navigation/Breadcrumb';
import { SectionHeader } from '../../shared/settings/SectionHeader';
import { SettingsActionsBar } from '../SettingsActionsBar';

const generateId = (): string => crypto.randomUUID();

const createNewTemplate = (): ExportTemplate => ({
  ...structuredClone(defaultExportTemplate),
  id: generateId(),
  name: 'New Template',
});

const TemplateOptionActions = ({
  templateId,
  onEdit,
  onDelete,
}: {
  templateId: string;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const isDefault = templateId === DEFAULT_TEMPLATE_ID;

  const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span
      className="ml-auto hidden shrink-0 gap-1 group-data-[focus]/option:flex"
      onPointerDownCapture={stopPropagation}
      onMouseDownCapture={stopPropagation}
      onClick={stopPropagation}
    >
      <IconButton
        as="span"
        icon={<PenIcon size={20} />}
        color="inherit"
        onClick={onEdit}
      />
      {!isDefault && (
        <IconButton
          as="span"
          icon={<TrashIcon size={20} />}
          color="inherit"
          onClick={onDelete}
        />
      )}
    </span>
  );
};

export const ExportsSettings = () => {
  const {
    templates,
    activeTemplateId,
    setActiveTemplateId,
    addTemplate,
    deleteTemplate,
  } = useContext(ExportTemplatesContext);
  const navigate = useNavigate();

  const handleNewTemplate = () => {
    const template = createNewTemplate();
    addTemplate(template);
    navigate(`/settings/exports/${template.id}`);
  };

  const handleEdit = (templateId: string) => {
    navigate(`/settings/exports/${templateId}`);
  };

  const handleDelete = (templateId: string) => {
    deleteTemplate(templateId);
  };

  useEffect(() => {
    document.title = 'v2 | Export Templates';
  }, []);

  return (
    <>
      <SettingsActionsBar>
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: 'Exports' },
          ]}
        />
      </SettingsActionsBar>
      <div className="container mx-auto my-6 max-w-2xl px-4">
        <SectionHeader icon={ExportIcon} heading="Export Templates" />
        <p className="mb-6 text-left text-sm text-zinc-500 dark:text-zinc-400">
          Export templates define the styles for the exported documents
        </p>
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Listbox
              value={activeTemplateId}
              onChange={setActiveTemplateId}
              modal={false}
            >
              {templates.map((template) => (
                <ListboxOption key={template.id} value={template.id}>
                  <ListboxLabel>{template.name}</ListboxLabel>
                  <TemplateOptionActions
                    templateId={template.id}
                    onEdit={() => handleEdit(template.id)}
                    onDelete={() => handleDelete(template.id)}
                  />
                </ListboxOption>
              ))}
            </Listbox>
          </div>
          <div className="flex-1" />
          <Button color="purple" onClick={handleNewTemplate}>
            New Template
          </Button>
        </div>
      </div>
    </>
  );
};
