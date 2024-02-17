import '../App.css';
import { default as A } from '@automerge/automerge/next';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';

interface Document {
  doc: A.Doc<string>;
}

export const Editor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [document, changeDocument] = useDocument<Document>(docUrl);

  return (
    <textarea
      id="message"
      value={document && document.doc}
      rows={4}
      className="block p-2.5 w-96 h-80 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
      placeholder="Write your thoughts here..."
      onChange={(e) =>
        changeDocument((document) => (document.doc = e.target.value))
      }
    />
  );
};
