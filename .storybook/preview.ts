import type { Preview } from '@storybook/react';

import '../src/renderer/src/App.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    darkMode: {
      darkClass: 'dark',
      stylePreview: true,
      classTarget: 'body',
    },
  },
};

export default preview;
