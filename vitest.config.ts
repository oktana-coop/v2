import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // Re-bundle through Vite so it resolves react-router from the same
        // entry point as the rest of the app, avoiding CJS/ESM dual-module issues.
        inline: ['storybook-addon-remix-react-router'],
      },
    },
  },
});
