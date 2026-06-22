import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { ElectronProvider } from '../../modules/infrastructure/cross-platform/browser';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ElectronProvider>
      <App />
    </ElectronProvider>
  </React.StrictMode>
);
