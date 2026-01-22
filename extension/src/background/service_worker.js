// Decision Drift - Background Service Worker
// Handles bookmark events, storage, alarms, notifications, and payment integration

// Inject prompt function (runs in page context)
function injectPrompt(bookmarkId, title, url) {
  'use strict';
  
  // Prevent duplicate prompts
  if (window.__ddPromptOpen) {
    const existing = document.getElementById('dd-prompt-container');
    if (existing) {
      existing.remove();
    }
  }
  
  window.__ddPromptOpen = true;
  
  // Create container
  const container = document.createElement('div');
  container.id = 'dd-prompt-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-width: calc(100vw - 40px);
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    padding: 0;
    animation: dd-slide-up 0.3s ease-out;
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes dd-slide-up {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    #dd-prompt-container * {
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);
  
  // Title
  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    padding: 20px 20px 12px;
    font-weight: 600;
    font-size: 16px;
    color: #1a1a1a;
  `;
  titleEl.textContent = 'When you come back to this, what will you be looking for?';
  
  // Domain preview
  const domainEl = document.createElement('div');
  domainEl.style.cssText = `
    padding: 0 20px 16px;
    font-size: 12px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  try {
    const domain = new URL(url).hostname;
    domainEl.textContent = domain;
  } catch (e) {
    domainEl.textContent = url.substring(0, 50);
  }
  
  // Buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  const intents = [
    { id: 'reference', label: 'Reference' },
    { id: 'apply', label: 'Apply' },
    { id: 'interesting', label: 'Just interesting' }
  ];
  
  intents.forEach(intent => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 10px 16px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      background: white;
      color: #1a1a1a;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    `;
    btn.textContent = intent.label;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f5f5f5';
      btn.style.borderColor = '#ccc';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'white';
      btn.style.borderColor = '#e0e0e0';
    });
    
    btn.addEventListener('click', () => {
      sendIntent(intent.id);
    });
    
    buttonsContainer.appendChild(btn);
  });
  
  // Skip button
  const skipBtn = document.createElement('button');
  skipBtn.style.cssText = `
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: #666;
    font-size: 13px;
    cursor: pointer;
    text-align: center;
    margin-top: 4px;
  `;
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', () => {
    sendDismiss();
  });
  
  // Assemble
  container.appendChild(titleEl);
  container.appendChild(domainEl);
  container.appendChild(buttonsContainer);
  container.appendChild(skipBtn);
  
  // Add to page
  document.body.appendChild(container);
  
  // Auto-remove after 30 seconds if no action
  const autoRemove = setTimeout(() => {
    if (container.parentNode) {
      container.remove();
      window.__ddPromptOpen = false;
    }
  }, 30000);
  
  function sendIntent(intent) {
    clearTimeout(autoRemove);
    chrome.runtime.sendMessage({
      type: 'DD_SET_INTENT',
      payload: { bookmarkId, intent }
    }, (response) => {
      if (container.parentNode) {
        container.remove();
        window.__ddPromptOpen = false;
      }
    });
  }
  
  function sendDismiss() {
    clearTimeout(autoRemove);
    chrome.runtime.sendMessage({
      type: 'DD_DISMISS',
      payload: { bookmarkId }
    }, (response) => {
      if (container.parentNode) {
        container.remove();
        window.__ddPromptOpen = false;
      }
    });
  }
}

// Import constants (using importScripts in service worker context)
importScripts('src/shared/constants.js');

const STORAGE_KEY = DD_CONSTANTS.STORAGE_KEY;
const LAST_RECEIPT_KEY = DD_CONSTANTS.LAST_RECEIPT_KEY;
const USER_ID_KEY = DD_CONSTANTS.USER_ID_KEY;
const PRO_KEY = DD_CONSTANTS.PRO_KEY;
const RECEIPT_VIEWS_KEY = DD_CONSTANTS.RECEIPT_VIEWS_KEY;
const BACKEND_URL = DD_CONSTANTS.BACKEND_URL;

// Initialize storage on install (batched for efficiency)
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([STORAGE_KEY, LAST_RECEIPT_KEY, USER_ID_KEY, PRO_KEY, RECEIPT_VIEWS_KEY]);
  
  // Batch all storage updates into a single call
  const updates = {};
  if (!data[STORAGE_KEY]) {
    updates[STORAGE_KEY] = {};
  }
  if (!data[USER_ID_KEY]) {
    updates[USER_ID_KEY] = `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  if (!data[PRO_KEY]) {
    updates[PRO_KEY] = { enabled: false, enabledAt: null, method: null };
  }
  if (data[RECEIPT_VIEWS_KEY] === undefined) {
    updates[RECEIPT_VIEWS_KEY] = 0;
  }
  
  // Single storage write for all updates
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  
  // Set up weekly alarm for receipt (only if Pro)
  await setupWeeklyAlarm();
});

async function setupWeeklyAlarm() {
  const data = await chrome.storage.local.get(PRO_KEY);
  const pro = data[PRO_KEY] || { enabled: false };
  
  if (pro.enabled) {
    chrome.alarms.create('DD_WEEKLY_RECEIPT', {
      periodInMinutes: 10080 // 7 days
    });
  } else {
    chrome.alarms.clear('DD_WEEKLY_RECEIPT');
  }
}

// Listen for bookmark creation
chrome.bookmarks.onCreated.addListener(async (bookmarkId, bookmark) => {
  // Skip folders (no URL)
  if (!bookmark.url) {
    return;
  }
  
  // Intent capture is available for all users (free feature)
  
  // Create pending record
  const record = {
    bookmarkId: bookmarkId.toString(),
    url: bookmark.url,
    title: bookmark.title || new URL(bookmark.url).hostname,
    createdAt: Date.now(),
    intent: null, // pending
    archived: false
  };
  
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  records[bookmarkId] = record;
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
  
  // Find active tab to inject prompt (non-blocking)
  chrome.tabs.query({ active: true, lastFocusedWindow: true })
    .then(tabs => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const title = bookmark.title || new URL(bookmark.url).hostname;
        
        // Inject content script (don't await to avoid blocking)
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: injectPrompt,
          args: [bookmarkId.toString(), title, bookmark.url]
        }).catch(error => {
          // Silently fail - injection may not work on all pages (e.g., chrome://)
          if (error.message && !error.message.includes('Cannot access')) {
            console.error('Failed to inject prompt:', error);
          }
        });
      }
    })
    .catch(() => {
      // Silently fail if tab query fails
    });
});

// Handle messages from content script and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DD_SET_INTENT') {
    handleSetIntent(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
  
  if (message.type === 'DD_DISMISS') {
    handleDismiss(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_GET_RECORDS') {
    chrome.storage.local.get(STORAGE_KEY).then(data => {
      sendResponse({ records: data[STORAGE_KEY] || {} });
    });
    return true;
  }
  
  if (message.type === 'DD_UPDATE_RECORD') {
    handleUpdateRecord(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_DELETE_BOOKMARK') {
    handleDeleteBookmark(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_VERIFY_LICENSE') {
    handleVerifyLicense(message.payload)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_GET_PRO') {
    chrome.storage.local.get(PRO_KEY).then(data => {
      sendResponse({ pro: data[PRO_KEY] || { enabled: false } });
    });
    return true;
  }
  
  if (message.type === 'DD_SET_PRO') {
    handleSetPro(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_TRACK_RECEIPT_VIEW') {
    handleTrackReceiptView()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_TRACK_LINK_CLICK') {
    handleTrackLinkClick(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_VERIFY_PRO_STATUS') {
    handleVerifyProStatus()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'DD_ACTIVATE_FROM_PAYMENT') {
    activateProFromPayment(message.payload.sessionId, message.payload.userId)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleSetIntent({ bookmarkId, intent }) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  if (records[bookmarkId]) {
    // Update in place for efficiency
    const record = records[bookmarkId];
    record.intent = intent;
    record.decidedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
  }
}

async function handleDismiss({ bookmarkId }) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  if (records[bookmarkId]) {
    // Update in place for efficiency
    const record = records[bookmarkId];
    record.intent = 'skipped';
    record.decidedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
  }
}

async function handleUpdateRecord({ bookmarkId, updates }) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  if (records[bookmarkId]) {
    Object.assign(records[bookmarkId], updates);
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
  }
}

async function handleDeleteBookmark({ bookmarkId }) {
  // Remove from Chrome bookmarks
  try {
    await chrome.bookmarks.remove(bookmarkId);
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
  }
  
  // Remove from our records
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  delete records[bookmarkId];
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
}

// Weekly alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'DD_WEEKLY_RECEIPT') {
    // Check Pro status before sending notification
    const data = await chrome.storage.local.get(PRO_KEY);
    const pro = data[PRO_KEY] || { enabled: false };
    
    if (pro.enabled) {
      // Create notification
      chrome.notifications.create('dd_weekly_receipt', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'Decision Drift',
        message: 'Your weekly Decision Receipt is ready!'
      });
      
      // Update last receipt time
      await chrome.storage.local.set({ [LAST_RECEIPT_KEY]: Date.now() });
    }
  }
});

// Notification click handler
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'dd_weekly_receipt') {
    chrome.tabs.create({ url: chrome.runtime.getURL('receipt.html') });
  }
  chrome.notifications.clear(notificationId);
});

// Backend URL is imported from constants above

// Activate Pro from payment session
async function activateProFromPayment(sessionId, userId) {
  try {
    // First try auto-create license endpoint (fallback if webhook didn't fire)
    const autoResponse = await fetch(`${BACKEND_URL}/api/auto-create-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId })
    });
    
    if (autoResponse.ok) {
      const autoData = await autoResponse.json();
      if (autoData.success && autoData.licenseKey) {
        // Pro activated via auto-create
        const proData = {
          enabled: true,
          enabledAt: Date.now(),
          method: 'stripe',
          licenseKey: autoData.licenseKey
        };
        await chrome.storage.local.set({ [PRO_KEY]: proData });
        await setupWeeklyAlarm();
        
        // Notify all extension pages
        chrome.runtime.sendMessage({ type: 'DD_PRO_UPDATED' }).catch(() => {});
        return { success: true };
      }
    }
    
    // Fallback: verify Pro status
    const verifyResponse = await handleVerifyProStatus();
    if (verifyResponse.success && verifyResponse.plan === 'pro') {
      // Already activated via webhook
      chrome.runtime.sendMessage({ type: 'DD_PRO_UPDATED' }).catch(() => {});
      return { success: true };
    }
    
    // If we get here, activation failed
    return { success: false, error: 'Payment not yet processed' };
  } catch (error) {
    console.error('Payment activation error:', error);
    // Payment may still be processing, try verification
    const verifyResponse = await handleVerifyProStatus();
    if (verifyResponse.success && verifyResponse.plan === 'pro') {
      chrome.runtime.sendMessage({ type: 'DD_PRO_UPDATED' }).catch(() => {});
      return { success: true };
    }
    return { success: false, error: error.message };
  }
}

// Verify Pro status with backend
async function handleVerifyProStatus() {
  try {
    const data = await chrome.storage.local.get([USER_ID_KEY, PRO_KEY]);
    const userId = data[USER_ID_KEY];
    
    if (!userId) {
      return { success: false, error: 'User ID not found' };
    }
    
    const response = await fetch(`${BACKEND_URL}/api/verify-pro-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error('Pro status verification failed');
    }
    
    const result = await response.json();
    
    if (result.valid && result.plan === 'pro') {
      // Update local Pro state
      const proData = {
        enabled: true,
        enabledAt: Date.now(),
        method: 'stripe',
        licenseKey: result.licenseKey || null
      };
      
      await chrome.storage.local.set({ [PRO_KEY]: proData });
      await setupWeeklyAlarm();
      
      return { success: true, plan: 'pro' };
    } else {
      // Not Pro, disable
      const proData = {
        enabled: false,
        enabledAt: null,
        method: null,
        licenseKey: null
      };
      
      await chrome.storage.local.set({ [PRO_KEY]: proData });
      await setupWeeklyAlarm();
      
      return { success: true, plan: 'basic' };
    }
  } catch (error) {
    console.error('Pro status verification error:', error);
    // On error, don't change state - return current state
    const data = await chrome.storage.local.get(PRO_KEY);
    const pro = data[PRO_KEY] || { enabled: false };
    return { success: false, plan: pro.enabled ? 'pro' : 'basic', error: error.message };
  }
}

// License verification (for dev/testing only)
async function handleVerifyLicense({ userId, licenseKey }) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/verify-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, licenseKey })
    });
    
    if (!response.ok) {
      throw new Error('License verification failed');
    }
    
    const data = await response.json();
    
    if (data.valid) {
      const proData = {
        enabled: true,
        enabledAt: Date.now(),
        method: 'key',
        licenseKey
      };
      await chrome.storage.local.set({ [PRO_KEY]: proData });
      await setupWeeklyAlarm();
      return { success: true, plan: 'pro' };
    } else {
      const proData = { enabled: false, enabledAt: null, method: null, licenseKey: null };
      await chrome.storage.local.set({ [PRO_KEY]: proData });
      await setupWeeklyAlarm();
      return { success: false, plan: 'basic' };
    }
  } catch (error) {
    console.error('License verification error:', error);
    return { success: false, error: error.message };
  }
}

// Pro state management
async function handleSetPro({ enabled, enabledAt, method, licenseKey }) {
  const proData = {
    enabled: enabled || false,
    enabledAt: enabledAt || (enabled ? Date.now() : null),
    method: method || null,
    licenseKey: licenseKey || null
  };
  
  await chrome.storage.local.set({ [PRO_KEY]: proData });
  
  // Update alarm based on Pro status
  await setupWeeklyAlarm();
  
  // If enabled via Stripe, verify with backend
  if (enabled && method === 'stripe') {
    // Verify in background (don't wait)
    handleVerifyProStatus().catch(err => {
      console.error('Background Pro verification failed:', err);
    });
  }
}

// Track receipt views for upsell
async function handleTrackReceiptView() {
  const data = await chrome.storage.local.get(RECEIPT_VIEWS_KEY);
  const views = (data[RECEIPT_VIEWS_KEY] || 0) + 1;
  await chrome.storage.local.set({ [RECEIPT_VIEWS_KEY]: views });
}

// Track link clicks for decision latency
async function handleTrackLinkClick({ bookmarkId }) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const records = data[STORAGE_KEY] || {};
  
  if (records[bookmarkId]) {
    const record = records[bookmarkId];
    const now = Date.now();
    
    // Set openedAt on first click
    if (!record.openedAt) {
      record.openedAt = now;
    }
    
    // Increment open count
    record.openCount = (record.openCount || 0) + 1;
    
    records[bookmarkId] = record;
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
  }
}
