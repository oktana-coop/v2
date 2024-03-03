// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  // process.env definition is needed because of:
  // https://github.com/vitejs/vite/issues/1973#issuecomment-787571499
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    // This is necessary because otherwise `vite dev` includes two separate
    // versions of the JS wrapper. This causes problems because the JS
    // wrapper has a module level variable to track JS side heap
    // allocations, and initializing this twice causes horrible breakage
    exclude: [
      '@automerge/automerge-wasm',
      '@automerge/automerge-wasm/bundler/bindgen_bg.wasm',
      '@syntect/wasm',
    ],
  },
  plugins: [topLevelAwait(), wasm(), react()],
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
});
