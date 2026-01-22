#!/bin/bash
# Simple ZIP creation script for Decision Drift Chrome Extension
# Creates a ZIP file from the extension directory for Chrome Web Store submission

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$SCRIPT_DIR/../extension"
VERSION=$(node -p "require('$EXT_DIR/manifest.json').version")
OUTPUT="$SCRIPT_DIR/../decision-drift-v${VERSION}.zip"

echo "Creating ZIP from extension directory..."

cd "$EXT_DIR"
zip -r "$OUTPUT" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*.zip" \
  -x "*.sh" \
  -x "*.md" \
  -x "node_modules/*" \
  -x "*.log"

echo ""
echo "✅ ZIP created: $OUTPUT"
echo "📋 Ready for Chrome Web Store submission"
