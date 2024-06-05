import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { EditorIndex } from './Editor/index';

import { History } from './pages/History/History';
import { Options } from './pages/Options/Options';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorIndex />} />
        <Route path="/edit" element={<EditorIndex />}>
          <Route path=":directory" element={<EditorIndex />}>
            <Route path=":documentId" element={<EditorIndex />} />
          </Route>
        </Route>
        <Route path="history" element={<History />}>
          <Route path=":directory" element={<History />}>
            <Route path=":documentId" element={<History />} />
          </Route>
        </Route>
        <Route path="/options" element={<Options />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
