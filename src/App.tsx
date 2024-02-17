import './App.css';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { Editor } from './Editor/Editor';

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  return <Editor docUrl={docUrl} />;
}

export default App;
