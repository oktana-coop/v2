# Testing Ubuntu APT Repository Automation

This guide covers how to test the Ubuntu publishing automation before creating a PR.

## Prerequisites

- Docker installed (`sudo pacman -S docker` on Arch)
- Docker daemon running (`sudo systemctl start docker`)
- GPG keys exported (`public.key` and `private.key` in repo root)

## Testing Levels

### Level 1: Script Testing (Local Docker) ⚡ Fast

Test that the script generates a valid APT repository:

```bash
cd /home/stathis/src/v2

# Make sure you have the keys
ls public.key private.key

# Run local test
chmod +x scripts/ubuntu/test-local.sh
./scripts/ubuntu/test-local.sh
```

**What it tests:**
- ✅ Downloads DEB packages from GitHub release
- ✅ Generates APT repository structure
- ✅ Creates Packages and Release files
- ✅ GPG signing works correctly
- ✅ All required files are present

**Time:** ~2-3 minutes (depending on download speed)

### Level 2: Installation Testing (Local Docker) ⚡ Fast

Test that users can install from the generated repository:

```bash
cd /home/stathis/src/v2

# Generate repository first (if not done)
./scripts/ubuntu/test-local.sh

# Test installation
chmod +x scripts/ubuntu/test-install.sh
./scripts/ubuntu/test-install.sh
```

**What it tests:**
- ✅ APT can read the repository
- ✅ GPG verification works
- ✅ Package is downloadable
- ✅ Package metadata is correct

**Time:** ~1 minute

### Level 3: Workflow Testing (GitHub Actions) 🌐 Realistic

Test the actual workflow on GitHub:

#### Option A: Test with Manual Workflow Trigger

Create a test workflow file:

```bash
cat > .github/workflows/test-ubuntu-publish.yml << 'EOF'
name: Test Ubuntu Publish
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to test (e.g., v0.11.7)'
        required: true
        default: 'v0.11.7'

jobs:
  test-publish-ubuntu:
    runs-on: ubuntu-latest
    steps:
      - name: Check out Git repository
        uses: actions/checkout@v4

      - name: Install APT repository tools
        run: |
          sudo apt-get update
          sudo apt-get install -y dpkg-dev apt-utils gnupg

      - name: Import GPG key
        run: |
          echo "${{ secrets.APT_GPG_PRIVATE_KEY }}" | gpg --batch --import
          gpg --list-secret-keys

      - name: Generate APT repository
        env:
          GPG_KEY_ID: ${{ secrets.APT_GPG_KEY_ID }}
        run: |
          chmod +x ./scripts/ubuntu/generate-apt-repo.sh
          ./scripts/ubuntu/generate-apt-repo.sh ${{ github.event.inputs.version }}

      - name: Upload repository as artifact
        uses: actions/upload-artifact@v4
        with:
          name: apt-repo
          path: apt-repo/

      - name: Verify repository structure
        run: |
          echo "Repository structure:"
          find apt-repo -type f | sort

          echo ""
          echo "Verifying GPG signatures:"
          gpg --verify apt-repo/dists/stable/Release.gpg apt-repo/dists/stable/Release
          gpg --verify apt-repo/dists/stable/InRelease
EOF

# Push and trigger
git add .github/workflows/test-ubuntu-publish.yml
git commit -m "test: add Ubuntu publish test workflow"
git push

# Then go to: https://github.com/oktana-coop/v2/actions
# Click "Test Ubuntu Publish" → "Run workflow"
```

#### Option B: Test with a Test Release

1. Create a test release tag:
```bash
git tag v0.11.7-test
git push origin v0.11.7-test
```

2. Create a draft release from that tag on GitHub
3. Publish the release
4. Watch the workflow run

**What it tests:**
- ✅ Full workflow execution
- ✅ Secrets are properly configured
- ✅ GitHub Actions environment
- ✅ Cross-repo access works

**Time:** ~5-10 minutes

### Level 4: End-to-End Testing (Real Ubuntu VM) 🖥️ Complete

Test the complete user experience on actual Ubuntu:

#### Option A: Using Multipass (Easiest on Arch)

```bash
# Install multipass
yay -S multipass

# Create Ubuntu VM
multipass launch 22.04 --name v2-test

# Shell into VM
multipass shell v2-test

# Inside the VM, add the repository and install
curl -fsSL https://oktana-coop.github.io/v2-deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] https://oktana-coop.github.io/v2-deb stable main" | sudo tee /etc/apt/sources.list.d/v2.list
sudo apt update
sudo apt install v2

# Test the application
v2 --version

# Cleanup when done
exit
multipass delete v2-test
multipass purge
```

#### Option B: Using Docker with X11 (Test actual app)

```bash
# Allow Docker to access X11
xhost +local:docker

docker run -it --rm \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  ubuntu:22.04 bash

# Inside container:
apt update && apt install curl gnupg
curl -fsSL https://oktana-coop.github.io/v2-deb/public.key | gpg --dearmor -o /usr/share/keyrings/v2-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] https://oktana-coop.github.io/v2-deb stable main" > /etc/apt/sources.list.d/v2.list
apt update
apt install -y v2
v2  # Should launch the app
```

## Recommended Testing Flow

Before creating a PR, follow this sequence:

1. **✅ Level 1** - Verify script works (`test-local.sh`)
2. **✅ Level 2** - Verify installation works (`test-install.sh`)
3. **✅ Level 3A** - Test workflow in GitHub Actions (manual trigger)
4. **✅ Level 4A** - Test real installation in Multipass VM (optional but recommended)

## Common Issues

### Docker permission denied
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### GPG key not found
```bash
# Make sure keys are exported
gpg --armor --export 10FD019ED4E2C91F > public.key
gpg --armor --export-secret-keys 10FD019ED4E2C91F > private.key
```

### Script can't download DEBs
- Check that the release exists and is published
- Check that DEB files are attached to the release
- Try with a different version number

### Workflow fails on GitHub
- Check that secrets are properly set
- Check workflow logs for specific error
- Verify GPG_KEY_ID matches your key

## Cleanup

After testing:

```bash
# Remove generated repository
rm -rf apt-repo/

# Remove test keys (if you created test ones)
rm -f private.key  # Never commit this!

# Keep public.key for v2-deb repository setup
```

## Next Steps

Once all tests pass:
1. Commit your changes (without private.key!)
2. Push to feature branch
3. Create PR
4. After merge, set up v2-deb repository
5. Create a real release to test production workflow
