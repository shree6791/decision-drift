#!/bin/bash
# Build script for Decision Drift Chrome Extension
# Creates a production-ready ZIP file for Chrome Web Store submission

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$SCRIPT_DIR/../extension"
BUILD_DIR="$SCRIPT_DIR/../build"
VERSION=$(node -p "require('$EXT_DIR/manifest.json').version")

echo "Building Decision Drift extension v${VERSION}..."

# Create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy extension files
echo "Copying extension files..."
cp -r "$EXT_DIR"/* "$BUILD_DIR/"

# Remove unnecessary files from build
echo "Cleaning build directory..."
find "$BUILD_DIR" -name "*.md" -not -path "*/icons/*" -delete
find "$BUILD_DIR" -name ".DS_Store" -delete
find "$BUILD_DIR" -name "*.sh" -delete

# Bump version (optional, can be skipped with --no-bump)
if [ "$1" != "--no-bump" ] && [ "$2" != "--no-bump" ]; then
  echo "Bumping version..."
  node "$SCRIPT_DIR/version-bump.js"
  VERSION=$(node -p "require('$EXT_DIR/manifest.json').version")
fi

# Create ZIP
echo "Creating ZIP file..."
cd "$BUILD_DIR"
ZIP_NAME="decision-drift-v${VERSION}.zip"
zip -r "../$ZIP_NAME" . -x "*.git*" "*.DS_Store" "*.zip" "*.sh" "*.md" "node_modules/*" "*.log"

echo ""
echo "✅ Build complete!"
echo "📦 ZIP file: $ZIP_NAME"
echo "📋 Ready for Chrome Web Store submission"
