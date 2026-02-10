#!/bin/bash
# Test APT repository installation in Docker
set -euo pipefail

echo "🐳 Testing APT repository installation..."

# This assumes you've already run test-local.sh and have apt-repo/ directory
if [ ! -d "apt-repo" ]; then
    echo "❌ Error: apt-repo directory not found"
    echo "Run ./scripts/ubuntu/test-local.sh first to generate the repository"
    exit 1
fi

cat > /tmp/test-install.sh << 'INNER_SCRIPT'
#!/bin/bash
set -euo pipefail

# Start a simple HTTP server for the repository
cd /workspace
python3 -m http.server 8080 --directory apt-repo &
SERVER_PID=$!
sleep 2

# Import GPG key
mkdir -p /usr/share/keyrings
gpg --dearmor < /workspace/public.key > /usr/share/keyrings/v2-archive-keyring.gpg

# Add repository (pointing to local server)
echo "deb [signed-by=/usr/share/keyrings/v2-archive-keyring.gpg] http://localhost:8080 stable main" > /etc/apt/sources.list.d/v2.list

# Update package list
echo ""
echo "📦 Updating package lists..."
apt-get update

# Check if package is available
echo ""
echo "🔍 Checking package availability..."
apt-cache policy v2

# Try to download (don't install since it's Electron and won't run in container)
echo ""
echo "📥 Testing package download..."
apt-get download v2

# Verify the package
echo ""
echo "✅ Downloaded package:"
ls -lh v2_*.deb

# Check package info
echo ""
echo "📋 Package information:"
dpkg-deb -I v2_*.deb

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "🎉 Installation test passed!"
INNER_SCRIPT

chmod +x /tmp/test-install.sh

# Run in Docker
docker run --rm \
  -v "$(pwd):/workspace" \
  -v "/tmp/test-install.sh:/test-install.sh" \
  -w /workspace \
  ubuntu:22.04 \
  bash /test-install.sh

echo ""
echo "✅ Installation testing complete!"
