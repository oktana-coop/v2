#!/bin/bash
# Generates APT repository structure with DEB packages
# Usage: ./generate-apt-repo.sh <version>
# Example: ./generate-apt-repo.sh v0.11.7

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.11.7"
    exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

echo "Generating APT repository for version ${VERSION}..."

# URLs for the DEB packages
AMD64_URL="https://github.com/oktana-coop/v2/releases/download/v${VERSION}/v2-${VERSION}-amd64.deb"
ARM64_URL="https://github.com/oktana-coop/v2/releases/download/v${VERSION}/v2-${VERSION}-arm64.deb"

# Download with retry (assets may not be immediately available after release)
download_deb() {
    local url="$1"
    local name="$2"
    local outfile="$3"

    for i in {1..15}; do
        echo "Downloading ${name} (attempt ${i}/15)..." >&2
        if curl -sfL "$url" -o "$outfile"; then
            echo "${name} downloaded successfully" >&2
            return 0
        fi
        echo "Download failed, retrying in 30s..." >&2
        sleep 30
    done

    echo "Failed to download ${name} after 15 attempts" >&2
    return 1
}

# Create repository structure
REPO_DIR="apt-repo"
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR/pool/main/v/v2"
mkdir -p "$REPO_DIR/dists/stable/main/binary-amd64"
mkdir -p "$REPO_DIR/dists/stable/main/binary-arm64"

# Download both DEBs in parallel
AMD64_DEB="$REPO_DIR/pool/main/v/v2/v2-${VERSION}-amd64.deb"
ARM64_DEB="$REPO_DIR/pool/main/v/v2/v2-${VERSION}-arm64.deb"

download_deb "$AMD64_URL" "amd64 DEB" "$AMD64_DEB" &
AMD64_PID=$!
download_deb "$ARM64_URL" "arm64 DEB" "$ARM64_DEB" &
ARM64_PID=$!

# Wait for both downloads to complete
wait $AMD64_PID
AMD64_EXIT=$?
wait $ARM64_PID
ARM64_EXIT=$?

# Check if either download failed
if [[ $AMD64_EXIT -ne 0 ]] || [[ $ARM64_EXIT -ne 0 ]]; then
    echo "One or both downloads failed" >&2
    exit 1
fi

# Verify DEBs are valid
echo "Verifying DEB packages..."
dpkg-deb -I "$AMD64_DEB" > /dev/null
dpkg-deb -I "$ARM64_DEB" > /dev/null
echo "DEB packages verified successfully"

# Generate Packages files
echo "Generating Packages files..."
cd "$REPO_DIR"

# Scan with multiversion to get both architectures
dpkg-scanpackages --multiversion pool/ /dev/null > /tmp/all-packages.txt 2>&1

# Split into architecture-specific files
awk 'BEGIN {RS=""; FS="\n"} /^Architecture: amd64/ {print; print ""}' /tmp/all-packages.txt > dists/stable/main/binary-amd64/Packages
awk 'BEGIN {RS=""; FS="\n"} /^Architecture: arm64/ {print; print ""}' /tmp/all-packages.txt > dists/stable/main/binary-arm64/Packages

# Compress Packages files
gzip -kf dists/stable/main/binary-amd64/Packages
gzip -kf dists/stable/main/binary-arm64/Packages

# Generate Release file
echo "Generating Release file..."
apt-ftparchive -c "${SCRIPT_DIR}/apt-repo-config" release dists/stable > dists/stable/Release

# Sign Release file (requires GPG_KEY_ID environment variable)
if [[ -z "${GPG_KEY_ID:-}" ]]; then
    echo "Warning: GPG_KEY_ID not set, skipping signing" >&2
else
    echo "Signing Release file..."
    # Generate detached signature
    gpg --batch --pinentry-mode loopback --default-key "${GPG_KEY_ID}" -abs -o dists/stable/Release.gpg dists/stable/Release
    # Generate inline signature
    gpg --batch --pinentry-mode loopback --default-key "${GPG_KEY_ID}" --clearsign -o dists/stable/InRelease dists/stable/Release
    echo "Release file signed successfully"
fi

cd ..

echo "APT repository generated successfully in ${REPO_DIR}/"
echo ""
echo "Repository structure:"
tree -L 4 "$REPO_DIR" || find "$REPO_DIR" -type f
