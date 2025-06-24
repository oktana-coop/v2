# v2

v2 is a local-first rich-text editor with versioning capabilities.

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

### Pull Git LFS Artifacts

```sh
$ git lfs pull
```

### Run

```sh
$ pnpm run dev
```

### Storybook

[Storybook](https://storybook.js.org) is used to build and render components in isolation.

To start Storybook, run:

```sh
pnpm run storybook
```

### Build

To build v2 in production mode, run:

```sh
pnpm run build
```

This will build the app under the `dist` directory. To run the built production version:

```sh
pnpm run start
```

## Release

To create artifacts for various operating systems, first build the app as shown above. Then run:

```sh
pnpm run app:dist
```

This will produce the artifacts in the `bin` directory.

### Debug release

If you need to debug the produced artifacts, you can run:

```sh
pnpm run app:dir
```

To extract and inspect the `asar` file contents (example for Linux build), in a directory named `test`:

```sh
pnpx @electron/asar extract bin/linux-unpacked/resources/app.asar test
```
