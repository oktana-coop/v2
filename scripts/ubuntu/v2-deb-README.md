# v2 APT Repository

This repository provides a Debian package repository for [v2](https://github.com/oktana-coop/v2), a local-first rich-text editor with versioning capabilities.

## Installation

### Ubuntu/Debian (via APT)

Add the repository and install v2 with these three commands:

```bash
# Add GPG key
curl -fsSL https://oktana-coop.github.io/v2-deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] https://oktana-coop.github.io/v2-deb stable main" | sudo tee /etc/apt/sources.list.d/v2.list

# Install v2
sudo apt update && sudo apt install v2
```

## Updates

Once installed via APT, v2 will be updated automatically with your system updates:

```bash
sudo apt update && sudo apt upgrade
```

## Supported Architectures

- **amd64** (x86_64)
- **arm64** (aarch64)

## Manual Installation

If you prefer not to use APT, you can download `.deb` packages directly from the [GitHub releases page](https://github.com/oktana-coop/v2/releases).

```bash
# Download the appropriate package for your architecture
wget https://github.com/oktana-coop/v2/releases/download/v0.11.7/v2-0.11.7-amd64.deb

# Install with dpkg
sudo dpkg -i v2-0.11.7-amd64.deb

# Install any missing dependencies
sudo apt-get install -f
```

## Repository Information

- **Origin**: Oktana Coop
- **Suite**: stable
- **Components**: main
- **Architectures**: amd64, arm64
- **Repository URL**: https://oktana-coop.github.io/v2-deb
- **Maintainer**: team@oktana.dev

## Repository Structure

This repository follows the standard Debian repository layout:

```
pool/main/v/v2/          # DEB packages
dists/stable/            # Repository metadata
├── Release              # Release information
├── Release.gpg          # GPG signature (detached)
├── InRelease            # GPG signature (inline)
└── main/
    ├── binary-amd64/    # amd64 package index
    └── binary-arm64/    # arm64 package index
```

## Automated Updates

This repository is automatically updated when a new version of v2 is released on GitHub. The update process:

1. Downloads `.deb` packages from the GitHub release
2. Generates APT repository metadata
3. Signs the repository with GPG
4. Publishes to GitHub Pages

## Verification

To verify the repository is properly configured:

```bash
# Check repository status
apt-cache policy v2

# Verify GPG key
apt-key list

# View package information
apt show v2
```

## Troubleshooting

### Repository not found

If you get "repository not found" errors:

1. Verify the repository line in `/etc/apt/sources.list.d/v2.list`
2. Ensure the GPG keyring exists at `/usr/share/keyrings/v2-archive-keyring.gpg`
3. Run `sudo apt update` again

### GPG verification errors

If you see GPG signature errors:

```bash
# Re-add the GPG key
curl -fsSL https://oktana-coop.github.io/v2-deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg
sudo apt update
```

## Uninstallation

To remove v2 and the repository:

```bash
# Remove the package
sudo apt remove v2

# Remove repository configuration
sudo rm /etc/apt/sources.list.d/v2.list
sudo rm /usr/share/keyrings/v2-archive-keyring.gpg
sudo apt update
```

## Source Code

The source code for v2 is available at: https://github.com/oktana-coop/v2

## License

v2 is open source software. See the [LICENSE](https://github.com/oktana-coop/v2/blob/main/LICENSE) file in the source repository for details.

## Support

For issues, questions, or contributions:

- **Issue Tracker**: https://github.com/oktana-coop/v2/issues
- **Website**: https://v2editor.com/
- **Email**: team@oktana.dev
