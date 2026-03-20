import { getExtension } from '../../../../../modules/infrastructure/filesystem';
import {
  FileDocumentIcon,
  ImageIcon,
  MarkdownIcon,
  PdfIcon,
} from '../../icons';
import { DocxIcon } from '../../icons/Docx';

export const FileExtensionIcon = ({
  fileName,
  size = 20,
}: {
  fileName: string;
  size?: number;
}) => {
  const extension = getExtension(fileName).toLowerCase();

  if (extension === 'md' || extension === 'markdown') {
    return (
      <MarkdownIcon
        className="mr-2 shrink-0 text-purple-500 dark:text-purple-300"
        size={size}
      />
    );
  }

  if (extension === 'docx' || extension === 'doc') {
    return (
      <DocxIcon
        className="mr-2 shrink-0 text-blue-500 dark:text-blue-300"
        size={size}
      />
    );
  }

  if (extension === 'pdf') {
    return (
      <PdfIcon
        className="mr-2 shrink-0 text-red-500 dark:text-red-300"
        size={size}
      />
    );
  }

  if (
    extension === 'png' ||
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'gif'
  ) {
    return (
      <ImageIcon
        className="mr-2 shrink-0 text-indigo-500 dark:text-indigo-300"
        size={size}
      />
    );
  }

  return (
    <FileDocumentIcon
      className="mr-2 shrink-0 text-zinc-700 dark:text-zinc-300"
      size={size}
    />
  );
};
