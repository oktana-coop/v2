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

### Pull Git LFS Artifacts

```sh
$ git lfs pull
```

### Run

```sh
$ pnpm run dev
```

### VSCode Debugging

It is possible to attach breakpoints to the main process code in VSCode if you do the following:

1. Run `pnpm run debug` **from your OS terminal** (outside VSCode)
2. Manually attach the VSCode debugger via the VSCode UI

Don't forget to close the debugger in the end of your session.

**Note:** There is an issue that seems to be related to EffectTS runtime when you start the app from the VSCode integrated terminal (we get Effect-related errors we don't get when we run it from the OS terminal).

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

## Release and Versioning

`v2` leverages [Semantic Versioning](https://semver.org/) as part of its Continuous Integration stategy.

Semantic version, in a nutshell, is the `vMAJOR.MINOR.PATCH` (f.e. `v0.1.1`) found in most applications and websites nowadays, where

- MAJOR version when you make incompatible API changes
- MINOR version when you add functionality in a backward compatible manner
- PATCH version when you make backward compatible bug fixes

Additionally, pre-release tags indicate alpha or beta software versions (as `v0.2.0-alpha` or `v5.9-beta.3`.)

### Release Workflow (GitHub CI)

There is a release workflow available in GitHub CI, which:

1. Creates a tag and a version bump commit
2. Builds the app and creates executables for various operating systems
3. Creates a new draft release with the executables as artifacts

If for any case the release workflow fails, the version bump and the commit are reverted automatically (in a conditional cleanup step of the worfklow itself).

By default, the release worfklow performs a **patch** update from the previous version (`v0.1.1` → `v0.1.2`), but this default is an option for the maintainer who runs the release worfklow. You can override this by including one of the following in the commit message: `#major`, `#minor`, or `#patch`. For details, see [bumping in github-tag-action](https://github.com/anothrNick/github-tag-action?tab=readme-ov-file#bumping).

### Package the app for your OS (locally)

To create artifacts for various operating systems, first build the app as shown above. Then run:

```sh
pnpm run package
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
