#!/bin/bash
#
# Builds, packages, and releases creem-cli, then updates the Homebrew formula.
#
# Usage: ./scripts/update-homebrew.sh
#
# Prerequisites:
# - gh CLI authenticated with armitage-labs access
# - pnpm/node installed
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$CLI_DIR"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TARBALL_NAME="creem-cli-${VERSION}.tgz"
RELEASE_TAG="v${VERSION}"
RELEASE_REPO="armitage-labs/creem-cli"

echo "Releasing creem-cli@${VERSION}"
echo ""

# Step 1: Build
echo "Building..."
pnpm build
echo "Build complete."

# Step 2: Package tarball
echo "Packaging tarball..."
npm pack > /dev/null 2>&1
if [ ! -f "$TARBALL_NAME" ]; then
    echo "Error: npm pack did not produce $TARBALL_NAME"
    exit 1
fi
echo "Packaged: $TARBALL_NAME"

# Step 3: Calculate SHA256
SHA256=$(shasum -a 256 "$TARBALL_NAME" | awk '{print $1}')
echo "SHA256: $SHA256"

# Step 4: Check if release already exists
echo ""
if gh release view "$RELEASE_TAG" --repo "$RELEASE_REPO" > /dev/null 2>&1; then
    echo "Release $RELEASE_TAG already exists on $RELEASE_REPO."
    read -p "Overwrite it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh release delete "$RELEASE_TAG" --repo "$RELEASE_REPO" --yes
    else
        echo "Aborting."
        rm -f "$TARBALL_NAME"
        exit 0
    fi
fi

# Step 5: Create GitHub release
echo "Creating release $RELEASE_TAG on $RELEASE_REPO..."
gh release create "$RELEASE_TAG" \
    "$TARBALL_NAME" \
    --repo "$RELEASE_REPO" \
    --title "creem-cli $RELEASE_TAG" \
    --notes "Release creem-cli ${VERSION}."
echo "Release created."

# Step 6: Update Homebrew formula
echo ""
echo "Updating Homebrew formula..."

TEMP_DIR=$(mktemp -d)
gh repo clone armitage-labs/homebrew-creem "$TEMP_DIR/homebrew-creem" --quiet

FORMULA_FILE="$TEMP_DIR/homebrew-creem/Formula/creem.rb"

# Update version in URL
sed -i '' "s|creem-cli-.*\.tgz|creem-cli-${VERSION}.tgz|g" "$FORMULA_FILE"
# Update release tag in URL
sed -i '' "s|/download/v[^/]*/|/download/${RELEASE_TAG}/|g" "$FORMULA_FILE"
# Update SHA256
sed -i '' "s|sha256 \".*\"|sha256 \"$SHA256\"|g" "$FORMULA_FILE"

echo ""
echo "Changes to formula:"
cd "$TEMP_DIR/homebrew-creem"
git diff Formula/creem.rb

echo ""
read -p "Push formula update? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add Formula/creem.rb
    git commit -m "chore: bump creem to ${RELEASE_TAG}"
    git push origin main
    echo ""
    echo "Done! Homebrew formula updated."
    echo "Users can install/upgrade with:"
    echo "  brew tap armitage-labs/creem"
    echo "  brew install creem"
    echo "  brew upgrade creem"
else
    echo "Formula not pushed. File at: $FORMULA_FILE"
fi

# Cleanup
rm -f "$CLI_DIR/$TARBALL_NAME"
rm -rf "$TEMP_DIR"
