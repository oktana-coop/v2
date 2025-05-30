import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { ElectronProvider } from '../../modules/infrastructure/cross-platform';
import { AppWrapper } from './AppWrapper';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ElectronProvider>
      <AppWrapper />
    </ElectronProvider>
  </React.StrictMode>
);
