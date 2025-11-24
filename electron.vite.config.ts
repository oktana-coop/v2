import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'electron-vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode);

  return {
    main: {
      define: {
        'process.env': env,
      },
      build: {
        rollupOptions: {
          external: ['better-sqlite3'],
        },
        sourcemap: true,
      },
    },
    preload: {
      build: {
        rollupOptions: {
          output: {
            format: 'cjs', // Set output format to CommonJS
            entryFileNames: 'index.js', // Customize the output file name
          },
        },
      },
    },
    renderer: {
      // Needed in the renderer because automerge dependencies
      // reference process.env.
      define: {
        'process.env': env,
      },
      resolve: {
        alias: {
          path: 'path-browserify',
        },
      },
      plugins: [topLevelAwait(), wasm(), react()],
      build: {
        rollupOptions: {
          output: {
            format: 'es',
          },
        },
      },
      worker: {
        format: 'es',
      },
    },
  };
});
