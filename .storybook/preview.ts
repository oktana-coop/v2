import '../src/renderer/src/App.css';
import './preview.css';

import { withConsole } from '@storybook/addon-console';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  decorators: [(storyFn, context) => withConsole()(storyFn)(context)],
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
