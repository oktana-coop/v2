# v2

v2 is a local-first rich-text editor with versioning capabilities.

Built on top of [Automerge](https://automerge.org/), [ProseMirror](https://prosemirror.net/) and integreted with the [Pandoc](https://pandoc.org/) ecosystem.

## Development notes

### Recommended tooling/practices

- Package manager: pnpm
- Node (version listed on `.nvmrc`)
- Commit style: [Conventional commits](https://www.conventionalcommits.org/)

### Install

```sh
$ pnpm install
```

### Run

```sh
$ pnpm run dev
```

## Storybook

[Storybook](https://storybook.js.org) is used to build and render components in isolation.

To start Storybook, run

```sh
$ pnpm run storybook
```
