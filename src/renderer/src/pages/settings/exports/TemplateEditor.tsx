import { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { type ExportTemplate } from '../../../../../modules/personalization/export-templates';
import { ExportTemplatesContext } from '../../../../../modules/personalization/export-templates/context';
import { Button } from '../../../components/actions/Button';
import { IconButton } from '../../../components/actions/IconButton';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '../../../components/dialogs/Dialog';
import { PenIcon } from '../../../components/icons';
import { Field, Label } from '../../../components/inputs/Fieldset';
import { Input } from '../../../components/inputs/Input';
import { Breadcrumb } from '../../../components/navigation/Breadcrumb';
import { SettingsActionsBar } from '../SettingsActionsBar';
import { StyleControls } from './StyleControls';
import { TemplatePreview } from './TemplatePreview';

const RenameDialog = ({
  open,
  name,
  onClose,
  onRename,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) => {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(name);
    }
  }, [open, name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onRename(trimmed);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Rename Template</DialogTitle>
        <DialogBody>
          <Field>
            <Label>Name</Label>
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </Field>
        </DialogBody>
        <DialogActions>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color="purple">
            Rename
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const TemplateEditor = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const { templates, updateTemplate } = useContext(ExportTemplatesContext);

  const template = templates.find((t) => t.id === templateId);
  const [localTemplate, setLocalTemplate] = useState<ExportTemplate | null>(
    template ?? null
  );
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  useEffect(() => {
    if (template) {
      setLocalTemplate(template);
    }
  }, [templateId]);

  useEffect(() => {
    if (localTemplate) {
      updateTemplate(localTemplate);
      document.title = `v2 | ${localTemplate.name}`;
    }
  }, [localTemplate]);

  if (!localTemplate) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">Template not found</p>
      </div>
    );
  }

  const handleRename = (name: string) => {
    setLocalTemplate({ ...localTemplate, name });
  };

  const handleTemplateChange = (updated: ExportTemplate) => {
    setLocalTemplate(updated);
  };

  return (
    <div className="flex h-full flex-col">
      <SettingsActionsBar>
        <Breadcrumb
          segments={[
            { label: 'Settings', href: '/settings' },
            { label: 'Exports', href: '/settings/exports' },
            { label: localTemplate.name },
          ]}
        />
        <IconButton
          icon={<PenIcon size={16} />}
          onClick={() => setIsRenameOpen(true)}
          tooltip="Rename template"
        />
      </SettingsActionsBar>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto px-6 pb-6">
          <TemplatePreview template={localTemplate} />
        </div>
        <div className="w-80 shrink-0 overflow-y-auto p-4">
          <StyleControls
            template={localTemplate}
            onChange={handleTemplateChange}
          />
        </div>
      </div>
      <RenameDialog
        open={isRenameOpen}
        name={localTemplate.name}
        onClose={() => setIsRenameOpen(false)}
        onRename={handleRename}
      />
    </div>
  );
};
