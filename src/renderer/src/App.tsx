import { useContext } from 'react';

import './App.css';
import { NavBar } from './components/navigation/NavBar';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { Editor } from './Editor/Editor';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Options } from './pages/Options/Options';
import { themes, ThemeContext } from './personalization/theme';
import clsx from 'clsx';
import { History } from './pages/History/History';

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const { theme } = useContext(ThemeContext);

  const themeStyles =
    theme === themes.dark ? 'dark bg-neutral-800' : 'light bg-[#fafafa]';

  return (
    <div className={clsx('flex flex-row h-full', themeStyles)}>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Editor docUrl={docUrl} />} />
          <Route path="/edit" element={<Editor docUrl={docUrl} />} />
          <Route path="/history/:documentId" element={<History />} />
          <Route path="/options" element={<Options />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
