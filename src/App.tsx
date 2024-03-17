import './App.css';
import { NavBar } from './components/navigation/NavBar';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { Editor } from './Editor/Editor';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  return (
    <div className="flex flex-row h-full">
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/edit" element={<Editor docUrl={docUrl} />} />
          {/* Add other routes here */}
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
