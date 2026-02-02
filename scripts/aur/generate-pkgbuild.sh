#!/bin/bash
# Generates PKGBUILD with correct version and checksums
# Usage: ./generate-pkgbuild.sh <version>
# Example: ./generate-pkgbuild.sh v0.11.2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.11.2"
    exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

echo "Generating PKGBUILD for version ${VERSION}..."

# URLs for the AppImages
X86_URL="https://github.com/oktana-coop/v2/releases/download/v${VERSION}/v2-${VERSION}-x86_64.AppImage"
ARM_URL="https://github.com/oktana-coop/v2/releases/download/v${VERSION}/v2-${VERSION}-arm64.AppImage"

# Download with retry (assets may not be immediately available after release)
download_checksum() {
    local url="$1"
    local name="$2"
    local outfile="$3"
    local sha=""

    for i in {1..15}; do
        echo "Downloading ${name} (attempt ${i}/15)..." >&2
        if sha=$(curl -sfL "$url" | sha256sum | cut -d' ' -f1) && [[ -n "$sha" ]]; then
            echo "${name} SHA256: ${sha}" >&2
            echo "$sha" > "$outfile"
            return 0
        fi
        echo "Download failed, retrying in 30s..." >&2
        sleep 30
    done

    echo "Failed to download ${name} after 15 attempts" >&2
    return 1
}

# Download both AppImages in parallel
X86_TMP=$(mktemp)
ARM_TMP=$(mktemp)

download_checksum "$X86_URL" "x86_64 AppImage" "$X86_TMP" &
X86_PID=$!
download_checksum "$ARM_URL" "aarch64 AppImage" "$ARM_TMP" &
ARM_PID=$!

# Wait for both downloads to complete
wait $X86_PID
X86_EXIT=$?
wait $ARM_PID
ARM_EXIT=$?

# Check if either download failed
if [[ $X86_EXIT -ne 0 ]] || [[ $ARM_EXIT -ne 0 ]]; then
    echo "One or both downloads failed" >&2
    rm -f "$X86_TMP" "$ARM_TMP"
    exit 1
fi

# Read checksums from temp files
X86_SHA=$(cat "$X86_TMP")
ARM_SHA=$(cat "$ARM_TMP")

# Clean up
rm -f "$X86_TMP" "$ARM_TMP"

# Generate PKGBUILD from template
echo "Generating PKGBUILD..."
sed -e "s/@@VERSION@@/${VERSION}/g" \
    -e "s/@@SHA256_X86_64@@/${X86_SHA}/g" \
    -e "s/@@SHA256_AARCH64@@/${ARM_SHA}/g" \
    "${SCRIPT_DIR}/PKGBUILD.template" > PKGBUILD

echo "PKGBUILD generated successfully!"
echo ""
echo "To test locally:"
echo "  makepkg -si"
echo ""
echo "To generate .SRCINFO:"
echo "  makepkg --printsrcinfo > .SRCINFO"
