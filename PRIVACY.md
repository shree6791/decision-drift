# Privacy Policy

**Last Updated:** [Date]

## Introduction

Decision Drift ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our Chrome extension.

## Data Collection and Storage

### Local Storage Only

**Decision Drift stores all your data locally on your device.** We do not send your bookmarks, URLs, or browsing data to any external servers.

The extension uses Chrome's local storage (`chrome.storage.local`) to store:

- **Bookmark Records**: URLs, titles, timestamps, and intent tags (Reference, Apply, Just interesting)
- **Receipt Data**: Weekly summaries of your bookmark decisions
- **User Preferences**: Your Pro subscription status and settings

**All this data remains on your device and is never transmitted to our servers.**

### Data We Do Not Collect

We do **NOT** collect:
- Your browsing history
- Websites you visit
- Personal information
- Email addresses
- IP addresses
- Device information
- Analytics or tracking data

## Payment Processing

### Stripe Integration

If you choose to upgrade to Pro, we use **Stripe** for payment processing. When you make a payment:

**Data Sent to Stripe:**
- Payment information (handled securely by Stripe)
- Anonymous user ID (generated locally, not linked to your identity)
- Extension ID (for redirect URLs)

**Data Sent to Our Backend:**
- Anonymous user ID (e.g., `dd_1234567890_abc123`)
- Stripe customer ID (for subscription management)
- Subscription status

**We do NOT receive or store:**
- Your payment card details (handled entirely by Stripe)
- Your name or email address
- Any personal identifying information

### Backend Server

Our backend server only stores:
- Anonymous user IDs
- Stripe customer IDs
- Subscription status (active/cancelled)
- License keys (for Pro verification)

**No bookmark data, URLs, or personal information is stored on our servers.**

## Data Sharing

**We do not sell, rent, or share your data with third parties**, except:

1. **Stripe**: For payment processing (subject to Stripe's privacy policy)
2. **Legal Requirements**: If required by law or to protect our rights

## Data Security

- All data is stored locally on your device using Chrome's secure storage
- Payment processing is handled by Stripe (PCI DSS compliant)
- Our backend uses industry-standard security practices
- We do not transmit sensitive data over unencrypted connections

## Your Rights

You have the right to:

- **Access**: View all data stored locally (via Chrome DevTools)
- **Delete**: Remove all extension data by uninstalling the extension
- **Export**: Your data is stored locally and can be accessed via Chrome's storage API
- **Control**: You control all data stored by the extension

## Data Retention

- **Local Data**: Stored on your device until you uninstall the extension or manually delete it
- **Backend Data**: Subscription data is retained while your subscription is active, and may be retained for legal/accounting purposes after cancellation

## Children's Privacy

Decision Drift is not intended for users under the age of 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this policy.

## Contact Us

If you have questions about this Privacy Policy, please contact us at:
- Email: [Your contact email]
- Website: [Your website]

## Third-Party Services

### Stripe

Payment processing is handled by Stripe. For information about how Stripe handles your data, please see [Stripe's Privacy Policy](https://stripe.com/privacy).

## Chrome Web Store

When you install Decision Drift from the Chrome Web Store, Google's Privacy Policy applies to the installation process. We do not receive any personal information from Google during installation.

## Summary

**In simple terms:**
- ✅ All your bookmark data stays on your device
- ✅ We don't track you or collect personal information
- ✅ Payment processing is handled securely by Stripe
- ✅ We only store anonymous subscription data on our servers
- ✅ You can delete all data by uninstalling the extension

**Your privacy is important to us. We built Decision Drift to be private by design.**
