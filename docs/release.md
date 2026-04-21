# Release and Versioning

`v2` leverages [Semantic Versioning](https://semver.org/) as part of its Continuous Integration stategy.

Semantic version, in a nutshell, is the `vMAJOR.MINOR.PATCH` (f.e. `v0.1.1`) found in most applications and websites nowadays, where

- MAJOR version when you make incompatible API changes
- MINOR version when you add functionality in a backward compatible manner
- PATCH version when you make backward compatible bug fixes

Additionally, pre-release tags indicate alpha or beta software versions (as `v0.2.0-alpha` or `v5.9-beta.3`.)

## Release Configuration

Build and packaging settings for [electron-builder](https://www.electron.build/) live in [`electron-builder.yml`](../electron-builder.yml) at the repo root. This covers per-OS targets and architectures, file associations, icons, code-signing hooks (macOS entitlements, Azure Trusted Signing for Windows), and the GitHub publish provider used to upload release artifacts.

Credentials for signing and publishing are **not** in this file — they're injected as environment variables from GitHub Actions secrets (see [Publishing the Release](#publishing-the-release) below).

## Release Workflow (GitHub CI)

There is a release workflow available in GitHub CI, which:

1. Creates a tag and a version bump commit
2. Builds the app and creates executables for various operating systems
3. Creates a new draft release with the executables as artifacts

If for any case the release workflow fails, the version bump and the commit are reverted automatically (in a conditional cleanup step of the worfklow itself).

By default, the release worfklow performs a **patch** update from the previous version (`v0.1.1` → `v0.1.2`), but this default is an option for the maintainer who runs the release worfklow. You can override this by including one of the following in the commit message: `#major`, `#minor`, or `#patch`. For details, see [bumping in github-tag-action](https://github.com/anothrNick/github-tag-action?tab=readme-ov-file#bumping).

### Publishing the Release

After the draft release is created, you can review and edit the release notes, then publish the release on GitHub.

#### macOS

Code signing and notarization are performed during the build process. No separate publish step is required.

Required secrets:

- `CSC_LINK` — Base64-encoded Developer ID Application `.p12` certificate. Used by electron-builder to sign the `.app` and `.dmg`. Export from Keychain Access on a Mac enrolled in the Apple Developer Program, then `base64 -i cert.p12 | pbcopy`.
- `CSC_KEY_PASSWORD` — Password set when exporting the `.p12` above.
- `APPLE_ID` — Apple ID email of the Apple Developer Program account. Used for notarization (sending the signed `.app` to Apple for malware scanning).
- `APPLE_TEAM_ID` — 10-character Team ID from https://developer.apple.com/account (membership page). Required because an Apple ID can belong to multiple teams.
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password (not the Apple ID's real password) generated at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords. Used by the notarization tool to authenticate non-interactively.

Rotation: certificates expire yearly, app-specific passwords don't expire but should be rotated if leaked. When rotating, regenerate `CSC_LINK` from the new `.p12` and update `CSC_KEY_PASSWORD` to match.

#### Windows

Note: Setting up code signing for Windows and GitHub CI was implemented based on [this guide](https://melatonin.dev/blog/code-signing-on-windows-with-azure-trusted-signing/).

Code signing is performed during the build process via [Azure Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/) (Microsoft's cloud code-signing service, replacement for EV certificates). This gives signed `.exe` installers instant Microsoft SmartScreen reputation — no blue "Windows protected your PC" warning on download. No separate publish step is required.

Required secrets:

- `AZURE_TENANT_ID` — Microsoft Entra (Azure AD) tenant ID. Find it in the Azure portal on the App Registration's Overview page, labeled "Directory (tenant) ID". Shared across every Azure resource in the account.
- `AZURE_CLIENT_ID` — App Registration's "Application (client) ID" from the same Overview page. Identifies _which_ service principal is authenticating.
- `AZURE_CLIENT_SECRET` — Client secret generated under the App Registration's "Certificates & secrets" page.
- `AZURE_ENDPOINT` — Regional signing endpoint URL, e.g. `https://weu.codesigning.azure.net/` for West Europe. Labeled "Account URI" on the Trusted Signing Account's Overview page in Azure.
- `AZURE_CODE_SIGNING_NAME` — Name of the Trusted Signing Account itself (not the App Registration).
- `AZURE_CERT_PROFILE_NAME` — Name of the Certificate Profile created inside the Trusted Signing Account. The profile binds to the validated business identity and determines the CN on issued certs.

#### Arch Linux

When a release is published, a separate `Publish Packages` workflow automatically triggers and publishes to AUR (Arch User Repository):

1. Generates a PKGBUILD file for the new version
2. Commits the PKGBUILD to the separate AUR package repository (`v2-bin` on aur.archlinux.org)
3. This is independent from the main source code repository

Required secrets: `AUR_USERNAME`, `AUR_EMAIL`, `AUR_SSH_PRIVATE_KEY`

#### Ubuntu/Debian

When a release is published, the `Publish Packages` workflow also publishes to a custom APT repository:

1. Downloads the `.deb` packages (amd64 and arm64) from the GitHub release
2. Generates APT repository metadata (Packages, Release files)
3. Signs the repository with GPG
4. Commits to the separate `v2-deb` repository hosted on GitHub Pages

This allows Ubuntu/Debian users to install and update v2 via `apt`. See [oktana-coop/v2-deb](https://github.com/oktana-coop/v2-deb) for installation instructions.

Required secrets: `APT_GPG_PRIVATE_KEY`, `APT_GPG_KEY_ID`, `GH_PAT`

## Package the app for your OS (locally)

To create artifacts for various operating systems, first build the app (`pnpm run build`). Then run:

```sh
pnpm run package
```

This will produce the artifacts in the `bin` directory.

## Debug release

If you need to debug the produced artifacts, you can run:

```sh
pnpm run app:dir
```

To extract and inspect the `asar` file contents (example for Linux build), in a directory named `test`:

```sh
pnpx @electron/asar extract bin/linux-unpacked/resources/app.asar test
```
