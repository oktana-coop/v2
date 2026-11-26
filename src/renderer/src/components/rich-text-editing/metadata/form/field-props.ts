import {
  type MetadataEdit,
  type prosemirror,
} from '../../../../../../modules/domain/rich-text';

export type EditMetadataFn = (edit: MetadataEdit) => void;

export type MetadataEditFailure = prosemirror.MetadataEditFailure;

export type FieldProps = {
  metadataKey: string;
  // The property's last failed edit.
  failure: MetadataEditFailure | undefined;
  onEdit: EditMetadataFn;
  onClearFailure: () => void;
};
