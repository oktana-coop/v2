export const SuggestedMergeInfoPanel = () => (
  <div className="flex flex-col gap-4 bg-purple-50 p-4 text-left dark:bg-purple-400/10">
    <div>
      This is a suggested merge preview. You can freely edit this document or
      turn off diff annotations. You’re editing what will become the final
      document.
    </div>
    <div>No changes will be applied until you accept.</div>
  </div>
);
