import './App.css';

import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Editor } from './pages/Editor/index';
import { History } from './pages/History/History';
import { Options } from './pages/Options/Options';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/edit" element={<Editor />}>
          <Route path=":documentId" element={<Editor />} />
        </Route>
        <Route path="history" element={<History />}>
          <Route path=":documentId" element={<History />} />
        </Route>
        <Route path="/options" element={<Options />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
