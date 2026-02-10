#!/bin/bash
# Local testing script for APT repository generation
set -euo pipefail

echo "🐳 Testing APT repository generation in Docker..."

# Create a test script that will run inside the container
cat > /tmp/test-apt-repo.sh << 'INNER_SCRIPT'
#!/bin/bash
set -euo pipefail

# Install required tools
apt-get update -qq
apt-get install -y dpkg-dev apt-utils gnupg curl

# Import GPG key
echo "Importing GPG key..."
gpg --batch --import /workspace/private.key 2>/dev/null || true

# Run the generation script
cd /workspace
export GPG_KEY_ID="10FD019ED4E2C91F"
./scripts/ubuntu/generate-apt-repo.sh v0.11.7

# Verify the structure
echo ""
echo "✅ Repository structure:"
find apt-repo -type f | sort

# Verify metadata files exist
echo ""
echo "✅ Checking required files..."
test -f apt-repo/pool/main/v/v2/v2-0.11.7-amd64.deb && echo "  ✓ amd64 DEB"
test -f apt-repo/pool/main/v/v2/v2-0.11.7-arm64.deb && echo "  ✓ arm64 DEB"
test -f apt-repo/dists/stable/main/binary-amd64/Packages && echo "  ✓ amd64 Packages"
test -f apt-repo/dists/stable/main/binary-arm64/Packages && echo "  ✓ arm64 Packages"
test -f apt-repo/dists/stable/Release && echo "  ✓ Release"
test -f apt-repo/dists/stable/Release.gpg && echo "  ✓ Release.gpg"
test -f apt-repo/dists/stable/InRelease && echo "  ✓ InRelease"

# Verify Packages files have content
echo ""
echo "✅ Sample from amd64 Packages file:"
head -15 apt-repo/dists/stable/main/binary-amd64/Packages

echo ""
echo "✅ Release file content:"
cat apt-repo/dists/stable/Release

echo ""
echo "✅ Verifying GPG signatures..."
gpg --verify apt-repo/dists/stable/Release.gpg apt-repo/dists/stable/Release 2>&1 | grep "Good signature" && echo "  ✓ Release.gpg signature valid"
gpg --verify apt-repo/dists/stable/InRelease 2>&1 | grep "Good signature" && echo "  ✓ InRelease signature valid"

echo ""
echo "🎉 All checks passed!"
INNER_SCRIPT

chmod +x /tmp/test-apt-repo.sh

# Run in Docker
docker run --rm \
  -v "$(pwd):/workspace" \
  -v "/tmp/test-apt-repo.sh:/test-apt-repo.sh" \
  -w /workspace \
  ubuntu:22.04 \
  bash /test-apt-repo.sh

echo ""
echo "✅ Local testing complete!"
echo "📁 Repository generated in: $(pwd)/apt-repo"
