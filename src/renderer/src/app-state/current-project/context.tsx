import { MultiDocumentProjectProvider } from './multi-document-project-context';

export const CurrentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <MultiDocumentProjectProvider>{children}</MultiDocumentProjectProvider>
  );
};
