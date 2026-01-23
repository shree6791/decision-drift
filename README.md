# Decision Drift

A Chrome extension that captures your intent when you bookmark pages, helping you remember why you saved something.

## Features

### Free Features
- 🎯 **Intent Capture**: When you create a bookmark, a small prompt asks what you're saving it for
- 📊 **Weekly Receipt**: See a summary of your bookmark decisions from the last 7 days (manual generation)
- 📋 **Review & Declutter**: Browse, archive, and manage your saved bookmarks with their intents

### Pro Features
- 🔔 **Automatic Weekly Receipts**: Get notified every week with your decision summary
- 📈 **Week-over-Week Trends**: Compare your bookmark patterns across weeks
- ⏱️ **Decision Latency Tracking**: See how long it takes you to act on "Apply" bookmarks
- 🎯 **Intent Honesty Insights**: Track the gap between what you say and what you do

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

4. **Upgrade to Pro**:
   - From Options, click **Pricing** or **Upgrade to Pro**
   - Subscribe to unlock automatic weekly receipts and advanced insights
   - Manage your subscription anytime from the Options page

## Testing

### Basic Functionality
- Create a bookmark → Prompt appears → Choose intent → Verify stored
- Create bookmark → Click Skip → Verify "skipped" intent stored
- Create bookmark → Wait 30 seconds → Prompt auto-dismisses

### Receipt Page
- Open receipt page → Shows counts for last 7 days (auto-generates on load)
- Create multiple bookmarks with different intents → Verify counts correct
- Pro users: Verify trends section shows week-over-week comparison

### Review Page
- Open review page → See list of bookmarks
- Search by title → Results filter correctly
- Search by domain → Results filter correctly
- Toggle "Show archived" → Archived items show/hide
- Click Archive → Bookmark marked as archived
- Click Unarchive → Bookmark unarchived
- Click "Remove Record" → Record removed (bookmark stays in Chrome)
- Click "Delete Bookmark" → Bookmark deleted from Chrome

### Weekly Alarm (Pro Only)
- In `chrome://extensions` → Find extension → Click "service worker" link
- In console, run: `chrome.alarms.create('DD_WEEKLY_RECEIPT', { delayInMinutes: 1 })`
- Wait 1 minute → Notification appears
- Click notification → Receipt page opens

### Payment Integration
See `STRIPE_SETUP.md` for complete setup and testing instructions.

## Project Structure

```
decision-drift/
  ├── extension/                    # Load THIS folder in Chrome
  │   ├── manifest.json            # Extension manifest (MV3)
  │   ├── icons/                   # Extension icons (16, 48, 128)
  │   └── src/
  │       ├── background/
  │       │   └── service_worker.js # Bookmark listener, storage, alarms, payments
  │       ├── shared/
  │       │   └── constants.js     # Shared constants (storage keys, backend URL)
  │       └── ui/
  │           ├── styles.css       # Shared styles
  │           ├── options/         # Options page (home, plan management)
  │           ├── popup/           # Extension popup
  │           ├── pricing/         # Pricing page (Stripe checkout)
  │           ├── receipt/         # Weekly receipt view (free + Pro trends)
  │           └── review/          # Bookmark review/declutter
  ├── backend/                      # Stripe payment backend
  │   ├── server.js                # Main server (Express)
  │   ├── database.js              # SQLite database service
  │   ├── licenseService.js        # License creation & validation
  │   └── webhookHandlers.js       # Stripe webhook handlers
  ├── scripts/                      # Build/utility scripts
  │   ├── build.sh                 # Production build script
  │   ├── create-zip.sh            # ZIP creation for Chrome Web Store
  │   ├── version-bump.js           # Auto-increment version
  │   └── generate-icons.html      # Icon generator
  ├── README.md                     # This file
  ├── PRIVACY.md                    # Privacy policy
  └── STRIPE_SETUP.md               # Stripe integration guide
```

## Data Storage

### Extension (Local Storage)

All bookmark data is stored locally in `chrome.storage.local`:

- `dd_records`: Object mapping bookmarkId → record
  ```js
  {
    bookmarkId: string,
    url: string,
    title: string,
    createdAt: number,
    intent: "reference"|"apply"|"interesting"|"skipped"|null,
    archived: boolean,
    decidedAt?: number,
    openedAt?: number,
    openCount?: number
  }
  ```
- `dd_lastReceiptAt`: Timestamp of last receipt generation
- `dd_pro`: Pro subscription state `{ enabled: boolean, enabledAt: number | null, method: string | null, licenseKey: string | null }`
- `dd_userId`: Unique user ID for payment integration
- `dd_receiptViews`: Number of times receipt page has been viewed

### Backend (SQLite Database)

The backend uses SQLite (`licenses.db`) to store:
- User IDs and Stripe customer IDs
- Subscription status and license keys
- Activation timestamps

**No bookmark data is stored on the backend** - all bookmark data remains local to your device.

## Permissions

- `bookmarks`: Listen for bookmark creation
- `storage`: Store records locally
- `alarms`: Weekly receipt notifications (Pro feature)
- `notifications`: Show receipt ready notification (Pro feature)
- `scripting`: Inject prompt UI into pages
- `activeTab`: Access active tab for prompt injection (more secure than broad permissions)

## Payment Integration

Decision Drift uses **Stripe** for secure payment processing. The Pro plan ($3.49/month) includes:

- **Automatic weekly receipt notifications**
- **Week-over-week trend analysis**
- **Decision latency tracking**
- **Intent honesty insights**

### For Users

- Subscribe directly from the extension's Pricing page
- Promotion codes can be applied at checkout
- Manage your subscription anytime from the Options page
- All payment processing is handled securely by Stripe

### For Developers

See `STRIPE_SETUP.md` for complete setup instructions, including:
- Stripe account configuration
- Backend deployment
- Webhook setup
- Environment variables
- Testing procedures

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

Decision Drift is built with privacy in mind:

- ✅ **All bookmark data stored locally** - Your bookmarks, URLs, and intents never leave your device
- ✅ **No tracking or analytics** - We don't track your browsing or collect analytics
- ✅ **Minimal backend usage** - Backend only used for payment processing (Stripe)
- ✅ **Anonymous payments** - Only anonymous user IDs sent to backend, no personal information
- ✅ **Secure payments** - Payment processing handled by Stripe (PCI DSS compliant)
- ✅ **SQLite database** - Backend uses local SQLite file for license storage (no cloud database)

For complete details, see [PRIVACY.md](PRIVACY.md).

## License

[Add your license here]

## Support

[Add support information]
