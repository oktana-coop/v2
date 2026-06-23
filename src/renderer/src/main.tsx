import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  ElectronProvider,
  isElectron,
} from '../../modules/infrastructure/cross-platform/browser';
import { App } from './App';

const rootElement = document.getElementById('root')!;

if (isElectron()) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ElectronProvider>
        <App />
      </ElectronProvider>
    </React.StrictMode>
  );
} else {
  rootElement.textContent =
    'v2 must be run as a desktop application, not in a web browser.';
}
