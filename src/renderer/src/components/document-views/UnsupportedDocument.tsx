import { UnsupportedFile } from '../illustrations/UnsupportedFile';

export type UnsupportedDocumentProps = {
  fileName: string;
};

export const UnsupportedDocument = ({ fileName }: UnsupportedDocumentProps) => {
  return (
    <div className="flex h-full w-full grow flex-col items-center pt-[15%]">
      <h2 className="m-4 text-2xl">Preview not available</h2>
      <div className="mb-8">
        <UnsupportedFile size={240} />
      </div>
      <p>
        <span className="font-medium">{fileName}</span> can&apos;t be displayed
        in the editor yet
      </p>
    </div>
  );
};
