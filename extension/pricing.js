// Pricing Page

const PRO_KEY = 'dd_pro';
const USER_ID_KEY = 'dd_userId';
const DEV_MODE = false; // Set to true for dev, or check manifest version

// Backend URL - Update this to your deployed backend URL
const BACKEND_URL = 'https://your-backend-url.com'; // TODO: Replace with your backend URL

let userId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const isPro = await checkProStatus();
  
  // If already Pro, don't set up checkout buttons
  if (isPro) return;
  
  // Get or create user ID
  const data = await chrome.storage.local.get(USER_ID_KEY);
  userId = data[USER_ID_KEY];
  
  if (!userId) {
    userId = `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  }
  
  // Setup event listeners
  const monthlyBtn = document.getElementById('unlock-monthly-btn');
  const yearlyBtn = document.getElementById('unlock-yearly-btn');
  const retryBtn = document.getElementById('retry-btn');
  const errorSection = document.getElementById('error-section');
  
  monthlyBtn?.addEventListener('click', () => handleStripeCheckout('monthly'));
  yearlyBtn?.addEventListener('click', () => handleStripeCheckout('yearly'));
  retryBtn?.addEventListener('click', () => {
    if (errorSection) errorSection.style.display = 'none';
  });
  
  // Dev mode (if enabled)
  if (isDevMode()) {
    const devSection = document.getElementById('dev-section');
    const activateBtn = document.getElementById('activate-btn');
    const licenseKey = document.getElementById('license-key');
    const devEnableBtn = document.getElementById('dev-enable-btn');
    const devDisableBtn = document.getElementById('dev-disable-btn');
    
    if (devSection) devSection.style.display = 'block';
    activateBtn?.addEventListener('click', handleActivate);
    licenseKey?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleActivate();
    });
    devEnableBtn?.addEventListener('click', handleDevEnable);
    devDisableBtn?.addEventListener('click', handleDevDisable);
  }
  
  // Check for success callback (from Stripe redirect)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    handleStripeSuccess();
  }
});

async function checkProStatus() {
  const data = await chrome.storage.local.get(PRO_KEY);
  const pro = data[PRO_KEY];
  
  if (pro?.enabled) {
    const pricingContent = document.querySelector('.pricing-content');
    if (pricingContent) {
      pricingContent.innerHTML = `
        <div class="pro-active">
          <h2>✅ Pro is Active</h2>
          <p>You're enjoying all Pro features!</p>
          <a href="receipt.html" class="btn btn-primary">View Receipt</a>
        </div>
      `;
    }
    return true; // Already Pro
  }
  
  return false; // Not Pro, continue setup
}

function isDevMode() {
  if (DEV_MODE) return true;
  try {
    // Check if we can access chrome.runtime.getManifest
    // In extension pages, this should work
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest();
      return manifest.version && (manifest.version.includes('dev') || manifest.version.includes('0.0.0'));
    }
  } catch (e) {
    // If we can't check, assume not dev mode
  }
  return false;
}

async function handleStripeCheckout(interval) {
  const loadingSection = document.getElementById('loading-section');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  
  // Check if backend URL is configured
  if (BACKEND_URL === 'https://your-backend-url.com' || !BACKEND_URL) {
    loadingSection.style.display = 'none';
    errorMessage.innerHTML = `
      <p><strong>Backend not configured</strong></p>
      <p>Please set up your backend server and update BACKEND_URL in pricing.js</p>
      <p>See STRIPE_SETUP.md for instructions.</p>
      <p><small>For testing, enable Dev Mode to use license keys instead.</small></p>
    `;
    errorSection.style.display = 'block';
    return;
  }
  
  loadingSection.style.display = 'block';
  errorSection.style.display = 'none';
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, interval })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Failed to create checkout session');
    }
    
    const data = await response.json();
    
    if (data.checkoutUrl) {
      // Redirect to Stripe checkout
      window.location.href = data.checkoutUrl;
    } else {
      throw new Error('No checkout URL received');
    }
  } catch (error) {
    loadingSection.style.display = 'none';
    errorMessage.innerHTML = `
      <p><strong>Checkout Error</strong></p>
      <p>${error.message || 'Failed to start checkout. Please try again.'}</p>
      <p><small>Make sure your backend server is running and BACKEND_URL is correct.</small></p>
    `;
    errorSection.style.display = 'block';
  }
}

async function handleStripeSuccess() {
  // Verify Pro status with backend
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DD_VERIFY_PRO_STATUS'
    });
    
    if (response && response.success) {
      // Show success message
      document.querySelector('.pricing-content').innerHTML = `
        <div class="pro-active">
          <h2>✅ Payment Successful!</h2>
          <p>Your Pro subscription is now active. Enjoy automatic weekly receipts and insights!</p>
          <a href="receipt.html" class="btn btn-primary">View Receipt</a>
        </div>
      `;
    } else {
      // Payment may still be processing
      document.querySelector('.pricing-content').innerHTML = `
        <div class="pro-active">
          <h2>Payment Received</h2>
          <p>Your payment is being processed. Pro features will be activated shortly.</p>
          <p>If you don't see Pro activated within a few minutes, please contact support.</p>
          <a href="receipt.html" class="btn btn-primary">View Receipt</a>
        </div>
      `;
    }
  } catch (error) {
    // Silently handle verification errors - payment may still be processing
  }
}

async function handleActivate() {
  const keyInput = document.getElementById('license-key');
  const key = keyInput.value.trim().toUpperCase();
  const errorEl = document.getElementById('unlock-error');
  const successEl = document.getElementById('unlock-success');
  
  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  
  // Validate format: DD-XXXX-XXXX
  const keyPattern = /^DD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  
  if (!key) {
    errorEl.textContent = 'Please enter a license key';
    errorEl.style.display = 'block';
    return;
  }
  
  if (!keyPattern.test(key)) {
    errorEl.textContent = 'Invalid format. Use: DD-XXXX-XXXX';
    errorEl.style.display = 'block';
    return;
  }
  
  // Verify with backend (dev mode only)
  try {
    const response = await fetch(`${BACKEND_URL}/api/verify-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, licenseKey: key })
    });
    
    const data = await response.json();
    
    if (data.valid) {
      const proData = {
        enabled: true,
        enabledAt: Date.now(),
        method: 'key',
        licenseKey: key
      };
      
      await chrome.storage.local.set({ [PRO_KEY]: proData });
      
      // Notify background to update
      await chrome.runtime.sendMessage({
        type: 'DD_SET_PRO',
        payload: proData
      });
      
      successEl.textContent = 'Pro activated! Redirecting...';
      successEl.style.display = 'block';
      
      setTimeout(() => {
        window.location.href = 'receipt.html';
      }, 1500);
    } else {
      errorEl.textContent = 'Invalid license key';
      errorEl.style.display = 'block';
    }
  } catch (error) {
    errorEl.textContent = 'Failed to verify license. Please try again.';
    errorEl.style.display = 'block';
  }
}

async function handleDevEnable() {
  const proData = {
    enabled: true,
    enabledAt: Date.now(),
    method: 'dev'
  };
  
  await chrome.storage.local.set({ [PRO_KEY]: proData });
  
  // Notify background to update
  await chrome.runtime.sendMessage({
    type: 'DD_SET_PRO',
    payload: proData
  });
  
  alert('Pro enabled (Dev mode)');
  window.location.href = 'receipt.html';
}

async function handleDevDisable() {
  const proData = {
    enabled: false,
    enabledAt: null,
    method: 'dev'
  };
  
  await chrome.storage.local.set({ [PRO_KEY]: proData });
  
  // Notify background to update
  await chrome.runtime.sendMessage({
    type: 'DD_SET_PRO',
    payload: proData
  });
  
  alert('Pro disabled');
  window.location.reload();
}
