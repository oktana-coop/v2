import { useContext } from 'react';

import clsx from 'clsx';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { Editor } from './Editor/Editor';
import { EditorIndex } from './Editor/index';
import { NavBar } from './components/navigation/NavBar';
import { HistoryIndex } from './pages/History';
import { History } from './pages/History/History';
import { Options } from './pages/Options/Options';
import { ThemeContext, themes } from './personalization/theme';

function App() {
  const { theme } = useContext(ThemeContext);

  const themeStyles =
    theme === themes.dark ? 'dark bg-neutral-800' : 'light bg-[#fafafa]';

  return (
    <div className={clsx('flex flex-row h-full', themeStyles)}>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<EditorIndex />} />
          <Route path="/edit" element={<EditorIndex />} />
          <Route path="/edit/:documentId" element={<Editor />} />
          <Route path="/history" element={<HistoryIndex />} />
          <Route path="/history/:documentId" element={<History />} />
          <Route path="/options" element={<Options />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
