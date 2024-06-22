export const InvalidDocument = () => {
  return (
    <div className="flex flex-auto">
      <div className="h-full w-full grow">
        <div className="flex h-full flex-col items-center justify-center">
          <h2 className="text-2xl">Invalid document ID</h2>
          <p className="text-gray-500">Please check the URL and try again.</p>
        </div>
      </div>
    </div>
  );
};
