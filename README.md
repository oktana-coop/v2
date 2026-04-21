# v2

[v2](https://v2editor.com/) is a local-first rich-text editor with versioning capabilities.

Built on top of [Automerge](https://automerge.org/), [ProseMirror](https://prosemirror.net/) and integrated with the [Pandoc](https://pandoc.org/) ecosystem.

## Development

### Recommended tooling/practices

- Package manager: pnpm
- Node (version listed on `.nvmrc`)
- [Git LFS](https://git-lfs.com/) (needed for WASM files)
- Commit style: [Conventional commits](https://www.conventionalcommits.org/)

### Install

```sh
$ pnpm install
```

### Environment Setup

The app uses two environment files, both gitignored:

- **`.env`** — Shared variables loaded in **all** modes (dev, build, test).
- **`.env.development`** — Dev-only overrides loaded only by `electron-vite dev`.

Copy the sample files to get started:

```sh
cp .env.sample .env
cp .env.development.sample .env.development
```

`VITE_DEV_SERVER_URL` lives in `.env.development` so that production builds (and E2E tests, which run against the built app) never try to connect to a dev server.

### Pull Git LFS Artifacts

```sh
$ git lfs pull
```

### Run

```sh
$ pnpm run dev
```

### VSCode Debugging

See [docs/vscode-debugging.md](docs/vscode-debugging.md) for attaching breakpoints to the main process.

### Testing

See [docs/testing.md](docs/testing.md) for Storybook and Playwright E2E setup.

### Build

To build v2 in production mode, run:

```sh
pnpm run build
```

This will build the app under the `dist` directory. To run the built production version:

```sh
pnpm run start
```

## Release and Versioning

See [docs/release.md](docs/release.md) for the release workflow, code signing setup per OS, and local packaging/debug instructions.
