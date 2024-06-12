import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'electron-vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode);

  return {
    publicDir: false,
    main: {
      define: {
        'process.env': env,
      },
    },
    preload: {},
    renderer: {
      // Needed in the renderer because automerge dependencies
      // reference process.env.
      define: {
        'process.env': env,
      },
      plugins: [topLevelAwait(), wasm(), react()],
    },
  };
});
