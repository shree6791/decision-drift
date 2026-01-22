// Shared constants across the extension
// Note: Chrome extensions don't support ES modules in all contexts
// This file can be imported using importScripts in service workers
// or included directly in UI scripts

// Storage keys
const STORAGE_KEY = 'dd_records';
const LAST_RECEIPT_KEY = 'dd_lastReceiptAt';
const USER_ID_KEY = 'dd_userId';
const PRO_KEY = 'dd_pro';
const RECEIPT_VIEWS_KEY = 'dd_receiptViews';

// Backend configuration
const BACKEND_URL = 'https://decision-drift.onrender.com'; // TODO: Replace with your backend URL

// Development mode
const DEV_MODE = false; // Set to true for dev, or check manifest version

// Intent options
const INTENTS = [
  { id: 'reference', label: 'Reference' },
  { id: 'apply', label: 'Apply' },
  { id: 'interesting', label: 'Just interesting' }
];

// Export for use in scripts (if using modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    LAST_RECEIPT_KEY,
    USER_ID_KEY,
    PRO_KEY,
    RECEIPT_VIEWS_KEY,
    BACKEND_URL,
    DEV_MODE,
    INTENTS
  };
}

// Make available globally for importScripts
if (typeof self !== 'undefined') {
  self.DD_CONSTANTS = {
    STORAGE_KEY,
    LAST_RECEIPT_KEY,
    USER_ID_KEY,
    PRO_KEY,
    RECEIPT_VIEWS_KEY,
    BACKEND_URL,
    DEV_MODE,
    INTENTS
  };
}
