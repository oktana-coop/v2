import './App.css';
import { NavBar } from './components/navigation/NavBar';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { Editor } from './Editor/Editor';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Options } from './pages/Options/Options';
import { useState } from 'react';
import {
  themes,
  ThemeContext,
  getDefaultTheme,
  Theme,
} from './personalization/theme';
import clsx from 'clsx';

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [theme, setTheme] = useState(getDefaultTheme());

  const handleSetTheme = (theme: Theme) => {
    localStorage.setItem('theme', theme);
    setTheme(theme);
  };

  const themeClasses =
    theme === themes.dark ? 'dark bg-neutral-800' : 'light bg-[#fafafa]';

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      <div className={clsx('flex flex-row h-full', themeClasses)}>
        <BrowserRouter>
          <NavBar />
          <Routes>
            <Route path="/edit" element={<Editor docUrl={docUrl} />} />
            <Route path="/options" element={<Options />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
