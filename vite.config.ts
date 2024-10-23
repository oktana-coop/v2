import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            target: 'esnext',
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              output: {
                format: 'cjs', // Set output format to CommonJS
                entryFileNames: 'index.js', // Customize the output file name
              },
            },
          },
        },
      },
      // Polyfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === 'test'
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
  ],
});
