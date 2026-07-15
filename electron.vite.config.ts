import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'electron-vite';
import path from 'path';
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
        externalizeDeps: false,
        rollupOptions: {
          external: ['better-sqlite3'],
        },
        sourcemap: true,
      },
    },
    preload: {
      build: {
        externalizeDeps: false,
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
      // @wasmer/wasi and buffer are only imported from the wasi-cli-worker web worker, so Vite's
      // initial dep scan misses them and re-optimizes on first worker load,
      // triggering a reload that breaks the Electron renderer. Pre-bundle them.
      optimizeDeps: {
        include: ['@wasmer/wasi', 'buffer'],
      },
      plugins: [topLevelAwait(), wasm(), react()],
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, 'src/renderer/index.html'),
            print: path.resolve(__dirname, 'src/renderer/print.html'),
            preview: path.resolve(__dirname, 'src/renderer/preview.html'),
          },
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
