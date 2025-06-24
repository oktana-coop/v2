import { PersonalFile } from '../illustrations/PersonalFile';

export const EmptyDocument = ({
  heading = 'Welcome to v2 👋',
  message,
  children,
}: {
  heading?: string;
  message: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className="flex h-full w-full grow flex-col items-center justify-center">
      <h2 className="m-4 text-2xl">{heading}</h2>
      <p>{message}</p>
      <PersonalFile />
      <p className="m-5 flex flex-col gap-2">{children}</p>
    </div>
  );
};
