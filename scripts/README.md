# Build Scripts

Utility scripts for building and packaging the Decision Drift Chrome Extension.

## Scripts

### `generate-icons.html`
Generates extension icons with "DD" text.

**Usage:**
1. Open `generate-icons.html` in your browser
2. Right-click each canvas and save as PNG
3. Save as `icon16.png`, `icon48.png`, `icon128.png`
4. Place files in `extension/icons/` folder

### `version-bump.js`
Automatically increments the patch version in `manifest.json`.

**Usage:**
```bash
node scripts/version-bump.js
```

**Example:**
- `1.0.0` → `1.0.1`
- `1.2.5` → `1.2.6`

### `create-zip.sh`
Creates a ZIP file from the extension directory for Chrome Web Store submission.

**Usage:**
```bash
./scripts/create-zip.sh
```

**Output:**
- Creates `decision-drift-v{version}.zip` in project root
- Excludes unnecessary files (`.git`, `.DS_Store`, `.md`, etc.)

### `build.sh`
Full build script that:
1. Copies extension files to a build directory
2. Cleans unnecessary files
3. Optionally bumps version
4. Creates a production-ready ZIP file

**Usage:**
```bash
# Build with version bump
./scripts/build.sh

# Build without version bump
./scripts/build.sh --no-bump
```

**Output:**
- Creates `build/` directory with cleaned extension files
- Creates `decision-drift-v{version}.zip` in project root

## Chrome Web Store Submission

1. **Prepare for submission:**
   ```bash
   ./scripts/build.sh
   ```

2. **Verify the ZIP:**
   - Extract and verify all files are present
   - Check that `manifest.json` is correct
   - Ensure icons are included

3. **Submit to Chrome Web Store:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Upload the ZIP file
   - Fill in store listing details
   - Submit for review

## Notes

- All scripts assume they're run from the project root
- The `build/` directory is temporary and can be deleted after creating the ZIP
- Version numbers follow semantic versioning (major.minor.patch)
- Make sure icons are generated and placed in `extension/icons/` before building
