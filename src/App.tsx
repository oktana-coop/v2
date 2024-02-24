import './App.css';
import './App.css';
import { Sidebar } from './Sidebar';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { Editor } from './Editor/Editor';

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  return (
    <div className="flex flex-row h-full">
      <Sidebar />
      <Editor docUrl={docUrl} />
    </div>
  );
}

export default App;
