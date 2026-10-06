import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Turns off Node's built-in localStorage, which doesn't work here and replaces jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: [
          // Re-bundle through Vite so it resolves react-router from the same
          // entry point as the rest of the app, avoiding CJS/ESM dual-module issues.
          'storybook-addon-remix-react-router',
          // isomorphic-git/managers uses ESM named imports from path-browserify
          // (a CJS module). Re-bundling resolves the named-export mismatch.
          'isomorphic-git',
        ],
      },
    },
  },
});
