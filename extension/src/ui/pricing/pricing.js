// Pricing Page

const PRO_KEY = 'dd_pro';
const USER_ID_KEY = 'dd_userId';
const DEV_MODE = false; // Set to true for dev, or check manifest version

// Backend URL - Update this to your deployed backend URL
const BACKEND_URL = 'https://decision-drift.onrender.com'; // TODO: Replace with your backend URL

// Pro subscription price
const PRO_PRICE = '$3.49/month';

let userId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check for payment completion first (similar to options page)
  await checkPaymentCompletion();
  
  // Get or create user ID (needed for both subscribe and manage)
  const data = await chrome.storage.local.get(USER_ID_KEY);
  userId = data[USER_ID_KEY];
  
  if (!userId) {
    userId = `dd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  }
  
  // Set the price in the table
  const priceElement = document.getElementById('pro-price');
  if (priceElement) {
    priceElement.textContent = PRO_PRICE;
  }
  
  const isPro = await checkProStatus();
  
  // Setup event listeners
  const subscribeBtn = document.getElementById('subscribe-btn');
  const manageBtn = document.getElementById('manage-subscription-btn');
  const retryBtn = document.getElementById('retry-btn');
  const errorSection = document.getElementById('error-section');
  
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', () => handleStripeCheckout());
  }
  
  if (manageBtn) {
    manageBtn.addEventListener('click', () => handleManageSubscription());
  }
  
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

// Check for payment completion from localStorage
async function checkPaymentCompletion() {
  try {
    // Check localStorage directly (we're in extension page context)
    const sessionId = localStorage.getItem('ddPaymentSessionId');
    const userIdFromLs = localStorage.getItem('ddPaymentUserId');
    const paymentTime = localStorage.getItem('ddPaymentTime');
    
    if (sessionId && userIdFromLs && paymentTime) {
      // Check if payment was recent (within last 10 minutes)
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      if (parseInt(paymentTime) >= tenMinutesAgo) {
        // Clear localStorage
        localStorage.removeItem('ddPaymentSessionId');
        localStorage.removeItem('ddPaymentUserId');
        localStorage.removeItem('ddPaymentTime');
        
        // Request background script to activate Pro
        const response = await chrome.runtime.sendMessage({ 
          type: 'DD_ACTIVATE_FROM_PAYMENT',
          payload: { sessionId, userId: userIdFromLs }
        });
        
        if (response && response.success) {
          // Pro activated, refresh status
          await checkProStatus();
          return true;
        }
      } else {
        // Too old, clear it
        localStorage.removeItem('ddPaymentSessionId');
        localStorage.removeItem('ddPaymentUserId');
        localStorage.removeItem('ddPaymentTime');
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking payment completion:', error);
    return false;
  }
}

async function checkProStatus() {
  const data = await chrome.storage.local.get(PRO_KEY);
  const pro = data[PRO_KEY];
  
  if (pro?.enabled) {
    // User is Pro - change button to "Manage Subscription"
    const subscribeBtn = document.getElementById('subscribe-btn');
    const subscribeSection = document.querySelector('.subscribe-section');
    
    if (subscribeBtn && subscribeSection) {
      // Hide subscribe button
      subscribeBtn.style.display = 'none';
      
      // Create manage subscription button
      const manageBtn = document.createElement('button');
      manageBtn.id = 'manage-subscription-btn';
      manageBtn.className = 'btn btn-secondary btn-large';
      manageBtn.textContent = 'Manage Subscription';
      manageBtn.addEventListener('click', () => handleManageSubscription());
      
      // Replace subscribe button with manage button
      subscribeBtn.parentNode.insertBefore(manageBtn, subscribeBtn);
      
      // Remove the promotion code note
      const note = subscribeSection.querySelector('.pricing-note');
      if (note) {
        note.style.display = 'none';
      }
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

async function handleStripeCheckout() {
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
    // Get extension ID and send it to backend
    const extensionId = chrome.runtime.id;
    
    const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, extensionId })
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

async function handleManageSubscription() {
  if (!userId) {
    alert('User ID not found. Please try again.');
    return;
  }
  
  try {
    // Get extension ID and send it to backend
    const extensionId = chrome.runtime.id;
    
    const response = await fetch(`${BACKEND_URL}/api/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, extensionId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create portal session');
    }
    
    const data = await response.json();
    
    // Redirect to Stripe portal
    if (data.portalUrl) {
      window.open(data.portalUrl, '_blank');
    } else {
      throw new Error('No portal URL received');
    }
  } catch (error) {
    alert('Failed to open subscription management. Please try again later.');
  }
}

async function handleStripeSuccess() {
  // Payment success is handled via the backend success page
  // which stores payment info in localStorage
  // The options page will automatically detect and activate Pro
  // Just show a message directing user to options page
  document.querySelector('.pricing-content').innerHTML = `
    <div class="pro-active">
      <h2>✅ Payment Successful!</h2>
      <p>Your payment has been received. Pro features are being activated...</p>
      <p><strong>Next step:</strong> Open the extension options page to see your Pro features activate automatically.</p>
      <a href="../options/options.html" class="btn btn-primary">Open Options</a>
    </div>
  `;
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
