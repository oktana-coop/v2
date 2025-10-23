export const LongTextSkeleton = () => (
  <div className="mx-auto w-full max-w-4xl animate-pulse space-y-4 p-6">
    {/* Title */}
    <div className="h-8 w-2/3 rounded bg-gray-200"></div>

    {/* Content paragraphs */}
    <div className="space-y-3 pt-2">
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-4/5 rounded bg-gray-200"></div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-11/12 rounded bg-gray-200"></div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-3/4 rounded bg-gray-200"></div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="h-4 w-full rounded bg-gray-200"></div>
        <div className="h-4 w-5/6 rounded bg-gray-200"></div>
      </div>
    </div>
  </div>
);
