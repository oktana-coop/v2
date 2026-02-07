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

#### Publishing the Release

After the draft release is created, you can review and edit the release notes, then publish the release on GitHub.

**macOS**

Code signing and notarization are performed during the build process. No separate publish step is required.

Required secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`

**Arch Linux**

When a release is published, a separate `Publish Packages` workflow automatically triggers and publishes to AUR (Arch User Repository):
1. Generates a PKGBUILD file for the new version
2. Commits the PKGBUILD to the separate AUR package repository (`v2-bin` on aur.archlinux.org)
3. This is independent from the main source code repository

Required secrets: `AUR_USERNAME`, `AUR_EMAIL`, `AUR_SSH_PRIVATE_KEY`

**Ubuntu/Debian**

When a release is published, the `Publish Packages` workflow also publishes to a custom APT repository:
1. Downloads the `.deb` packages (amd64 and arm64) from the GitHub release
2. Generates APT repository metadata (Packages, Release files)
3. Signs the repository with GPG
4. Commits to the separate `v2-deb` repository hosted on GitHub Pages

This allows Ubuntu/Debian users to install and update v2 via `apt`. See [oktana-coop/v2-deb](https://github.com/oktana-coop/v2-deb) for installation instructions.

Required secrets: `APT_GPG_PRIVATE_KEY`, `APT_GPG_KEY_ID`, `GH_PAT`

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
