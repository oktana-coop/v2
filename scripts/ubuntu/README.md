# Ubuntu/Debian APT Repository Automation

This directory contains scripts for automatically publishing v2 to a custom APT repository hosted on GitHub Pages.

## Files

- **`generate-apt-repo.sh`** - Generates APT repository structure from GitHub release assets
- **`apt-repo-config`** - Configuration for apt-ftparchive
- **`v2-deb-README.md`** - Template for the v2-deb repository README (copy to v2-deb repo)

## How It Works

When a GitHub release is published, the `publish-ubuntu` workflow job:
1. Downloads `.deb` packages (amd64 and arm64) from the release
2. Runs `generate-apt-repo.sh` to create APT repository structure
3. Signs the repository with GPG
4. Pushes to the `oktana-coop/v2-deb` repository (hosted on GitHub Pages)

Users can then install v2 via: `apt install v2`

## One-Time Setup

### 1. Create v2-deb Repository

1. Create repository at: https://github.com/organizations/oktana-coop/repositories/new
   - Name: `v2-deb`
   - Visibility: Public
   - Initialize with README

2. Enable GitHub Pages:
   - Settings → Pages
   - Source: Deploy from branch `main`, root directory
   - Save

### 2. Generate GPG Key

**Use existing key or generate new:**

```bash
# Generate new key (if needed)
gpg --full-generate-key
# Choose: RSA 4096, no expiration (or 2+ years)
# Name: Oktana Coop APT Repository
# Email: team@oktana.dev

# Export keys
gpg --list-secret-keys --keyid-format LONG  # Note the key ID
gpg --armor --export KEY_ID > public.key
gpg --armor --export-secret-keys KEY_ID > private.key
```

**Your key ID is:** `10FD019ED4E2C91F`

### 3. Add GitHub Secrets

Add to the **v2 repository** at: https://github.com/oktana-coop/v2/settings/secrets/actions

1. **`APT_GPG_KEY_ID`** = `10FD019ED4E2C91F`
2. **`APT_GPG_PRIVATE_KEY`** = Contents of `private.key` (full armored key)
3. **`GH_PAT`** = Personal Access Token with `repo` scope
   - Create at: https://github.com/settings/tokens/new

**Delete `private.key` after adding to secrets!**

### 4. Initialize v2-deb Repository

```bash
# Clone and setup
git clone git@github.com:oktana-coop/v2-deb.git
cd v2-deb

# Create directory structure
mkdir -p pool/main/v/v2
mkdir -p dists/stable/main/binary-{amd64,arm64}

# Copy files
cp /path/to/public.key .
cp /home/stathis/src/v2/scripts/ubuntu/v2-deb-README.md README.md

# Commit and push
git add .
git commit -m "Initial repository setup"
git push origin main
```

### 5. Test with a Release

Create a new release and monitor:
- https://github.com/oktana-coop/v2/actions
- Watch the `publish-ubuntu` job
- Verify v2-deb repository gets updated
- Test installation on Ubuntu VM

## Testing Installation

```bash
# Add repository
curl -fsSL https://oktana-coop.github.io/v2-deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] https://oktana-coop.github.io/v2-deb stable main" | sudo tee /etc/apt/sources.list.d/v2.list

# Install
sudo apt update && sudo apt install v2

# Verify
v2 --version
```

## Troubleshooting

### Workflow fails: "No secret key"
- Verify `APT_GPG_PRIVATE_KEY` contains the complete armored key
- Verify `APT_GPG_KEY_ID` matches your key ID

### Workflow fails: "Permission denied"
- Verify `GH_PAT` has `repo` scope
- Verify token hasn't expired

### DEB download fails
- Workflow retries 15 times with 30s delays
- GitHub may take a few minutes to make release assets available

### Manual Repository Update

If the workflow fails, run locally:

```bash
cd /home/stathis/src/v2
export GPG_KEY_ID="10FD019ED4E2C91F"
./scripts/ubuntu/generate-apt-repo.sh v0.11.7

# Then copy to v2-deb and push
cp -r apt-repo/* /path/to/v2-deb/
cd /path/to/v2-deb
git add . && git commit -m "Update to v0.11.7" && git push
```

## Maintenance

**Key Rotation:**
1. Generate new key
2. Export and update GitHub secrets
3. Update `public.key` in v2-deb repository
4. Notify users to re-import key

**Cleaning Old Packages:**
The repository will accumulate packages. To keep it lean, periodically remove old versions from `pool/main/v/v2/` in the v2-deb repository.

## Repository Structure

The v2-deb repository follows standard Debian layout:

```
v2-deb/
├── pool/main/v/v2/          # .deb packages
│   ├── v2-0.11.7-amd64.deb
│   └── v2-0.11.7-arm64.deb
├── dists/stable/            # Repository metadata
│   ├── Release              # Signed release file
│   ├── Release.gpg          # Detached signature
│   ├── InRelease            # Inline signature
│   └── main/
│       ├── binary-amd64/Packages{,.gz}
│       └── binary-arm64/Packages{,.gz}
├── public.key               # GPG public key
└── README.md                # User documentation
```
