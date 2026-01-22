# Decision Drift

A Chrome extension that captures your intent when you bookmark pages, helping you remember why you saved something.

## Features

- 🎯 **Intent Capture**: When you create a bookmark, a small prompt asks what you're saving it for
- 📊 **Weekly Receipt**: See a summary of your bookmark decisions from the last 7 days
- 📋 **Review & Declutter**: Browse, archive, and manage your saved bookmarks with their intents
- 💳 **Pro Plan**: Upgrade for advanced features (coming soon)

## Installation

### Load Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `extension/` folder (the folder containing `manifest.json`)
6. The extension is now installed!

### Icons

Generate icons using `scripts/generate-icons.html`:
1. Open the file in your browser
2. Right-click each canvas and save as PNG
3. Save as `icon16.png`, `icon48.png`, `icon128.png`
4. Place files in `extension/icons/` folder

## Usage

1. **Create a Bookmark**: When you bookmark any page (Ctrl+D / Cmd+D), a small prompt appears asking what you're saving it for
   - Choose: **Reference**, **Apply**, or **Just interesting**
   - Or click **Skip** to dismiss

2. **View Receipt**: 
   - Right-click the extension icon → **Options**
   - Or go to `chrome://extensions` → Find "Decision Drift" → Click **Options**
   - Click **Decision Receipt** to see your weekly summary

3. **Review Bookmarks**:
   - From Options, click **Review Bookmarks**
   - Search, filter, archive, or remove bookmarks
   - Delete bookmarks directly from Chrome if needed

## Testing Checklist

### Basic Functionality
- [ ] Create a bookmark → Prompt appears → Choose intent → Verify stored
- [ ] Create bookmark → Click Skip → Verify "skipped" intent stored
- [ ] Create bookmark → Wait 30 seconds → Prompt auto-dismisses

### Receipt Page
- [ ] Open receipt page → Shows counts for last 7 days
- [ ] Click "Generate Receipt" → Counts update
- [ ] Create multiple bookmarks with different intents → Verify counts correct

### Review Page
- [ ] Open review page → See list of bookmarks
- [ ] Search by title → Results filter correctly
- [ ] Search by domain → Results filter correctly
- [ ] Toggle "Show archived" → Archived items show/hide
- [ ] Click Archive → Bookmark marked as archived
- [ ] Click Unarchive → Bookmark unarchived
- [ ] Click "Remove Record" → Record removed (bookmark stays in Chrome)
- [ ] Click "Delete Bookmark" → Bookmark deleted from Chrome

### Weekly Alarm
- [ ] In `chrome://extensions` → Find extension → Click "service worker" link
- [ ] In console, run: `chrome.alarms.create('DD_WEEKLY_RECEIPT', { delayInMinutes: 1 })`
- [ ] Wait 1 minute → Notification appears
- [ ] Click notification → Receipt page opens

### Payment Integration (Requires Backend)
- [ ] Set up backend server (see `STRIPE_SETUP.md`)
- [ ] Update `BACKEND_URL` in extension files
- [ ] Click "Upgrade to Pro" → Stripe checkout opens
- [ ] Complete payment → Plan updates to Pro
- [ ] Click "Manage Subscription" → Stripe portal opens

## Project Structure

```
decision-drift/
  ├── extension/                    # Load THIS folder in Chrome
  │   ├── manifest.json            # Extension manifest (MV3)
  │   ├── icons/                   # Extension icons (16, 48, 128)
  │   └── src/
  │       ├── background/
  │       │   └── service_worker.js # Bookmark listener, storage, alarms
  │       ├── shared/
  │       │   └── constants.js     # Shared constants
  │       └── ui/
  │           ├── styles.css       # Shared styles
  │           ├── options/         # Options page
  │           ├── popup/           # Extension popup
  │           ├── pricing/         # Pricing page
  │           ├── receipt/         # Weekly receipt view
  │           └── review/          # Bookmark review/declutter
  ├── backend/                      # Stripe payment backend
  ├── scripts/                      # Build/utility scripts
  └── README.md
```

## Data Storage

All data is stored locally in `chrome.storage.local`:

- `dd_records`: Object mapping bookmarkId → record
  ```js
  {
    bookmarkId: string,
    url: string,
    title: string,
    createdAt: number,
    intent: "reference"|"apply"|"interesting"|"skipped"|null,
    archived: boolean,
    decidedAt?: number
  }
  ```
- `dd_lastReceiptAt`: Timestamp of last receipt generation
- `dd_pro`: Pro subscription state `{ enabled: boolean, enabledAt: number | null, method: string | null, licenseKey: string | null }`
- `dd_userId`: Unique user ID for payment integration
- `dd_receiptViews`: Number of times receipt page has been viewed

## Permissions

- `bookmarks`: Listen for bookmark creation
- `storage`: Store records locally
- `alarms`: Weekly receipt notifications
- `notifications`: Show receipt ready notification
- `scripting`: Inject prompt UI into pages
- `tabs`: Find active tab for injection
- `<all_urls>`: Inject prompt on any site

## Payment Integration

The extension supports Stripe payment integration for a Pro plan. See `STRIPE_SETUP.md` for detailed setup instructions.

**Quick Setup:**
1. Deploy backend server (see `backend/server.js`)
2. Update `BACKEND_URL` in extension files:
   - `src/shared/constants.js`
   - `src/background/service_worker.js`
   - `src/ui/options/options.js`
   - `src/ui/pricing/pricing.js`
3. Configure Stripe keys and webhook (see `STRIPE_SETUP.md`)

## Development

### Testing Locally

1. Load extension as unpacked (see Installation)
2. Open DevTools for background service worker:
   - Go to `chrome://extensions`
   - Find "Decision Drift"
   - Click "service worker" link
3. Test bookmark creation on any website
4. Check storage: `chrome.storage.local.get(null, console.log)`

### Building for Production

Use the build scripts:

```bash
# Full build (bumps version and creates ZIP)
./scripts/build.sh

# Or just create ZIP without version bump
./scripts/create-zip.sh
```

See `scripts/README.md` for more details.

## Privacy

- ✅ All data stored locally (no external storage)
- ✅ No tracking or analytics
- ✅ Backend only used for payment processing (Stripe)
- ✅ No personal data sent to backend (only anonymous user ID)

## License

[Add your license here]

## Support

[Add support information]
