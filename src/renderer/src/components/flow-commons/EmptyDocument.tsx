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
    <div className="h-full w-full grow flex flex-col items-center justify-center">
      <h2 className="text-2xl m-2">{heading}</h2>
      <p>{message}</p>
      <p className="m-5">{children}</p>
      <PersonalFile />
    </div>
  );
};
