# Testing

## Unit Tests

Unit tests use [Vitest](https://vitest.dev/) and live alongside the source in `src/`.

**Run once:**

```sh
pnpm run test
```

**Watch mode:**

```sh
pnpm run test:watch
```

## Storybook

[Storybook](https://storybook.js.org) is used to build and render components in isolation.

To start Storybook, run:

```sh
pnpm run storybook
```

## E2E Tests

End-to-end tests use [Playwright](https://playwright.dev/) with its Electron integration, running against the **built** app.

**Run all tests** (builds first):

```sh
pnpm run test:e2e
```

**Run all tests without the window appearing** (useful when working in parallel):

```sh
pnpm run test:e2e:headless
```

> This passes `--headless-window` to the Electron process, which creates the
> `BrowserWindow` with `show: false`. Playwright can still interact with the
> renderer normally. We use a CLI flag instead of an env var because
> electron-vite bakes `process.env` into the bundle at build time; a runtime
> env var would require a separate E2E-specific build, which we want to avoid.

**Open the Playwright UI** (test timeline, action logs, attachments):

```sh
pnpm run test:e2e:ui
```

> Note: the Playwright UI's browser preview panel does not work for Electron apps — the Electron window itself is the live view.

**Step through a test with DevTools** (opens Playwright Inspector, pauses before each action):

```sh
pnpm run test:e2e:debug
```

The Inspector pauses before every action, keeping the Electron window open so you can right-click → Inspect or open DevTools from the View menu.

**View the HTML report** from the last run:

```sh
pnpm run test:e2e:report
```

Test files live in `e2e/`. Results (JSON, HTML report, failure screenshots) are written to `e2e-results/`.
